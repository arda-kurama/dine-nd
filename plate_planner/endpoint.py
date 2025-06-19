"""
Flask API for DineND meal planning.

Provides:
  - Health check at `/`
  - Section listing for a given hall & meal at `/sections`
  - Plate planning (macro-based) at `/plan-plate`
    which queries Pinecone and GPT-4 for a balanced meal.
"""

import json
import os
import re
from functools import lru_cache
from urllib.request import urlopen
from itertools import combinations, product

from flask import Flask, jsonify, request
from openai import OpenAI
from pinecone import Pinecone

app = Flask(__name__)

# Lazy helpers – created only on first real request
@lru_cache
def get_openai() -> OpenAI:
    """
    Return a cached OpenAI client.
    Raises an error if API key is not set.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing from environment")
    return OpenAI(api_key=api_key)

@lru_cache
def get_pinecone_index():
    """
    Return a cached Pinecone Index instance.
    Expects PINECONE_API_KEY and PINECONE_ENV in env.
    """
    key = os.getenv("PINECONE_API_KEY")
    env = os.getenv("PINECONE_ENV")
    if not key or not env:
        raise RuntimeError("PINECONE_API_KEY / PINECONE_ENV missing from environment")
    pc = Pinecone(api_key=key, environment=env)
    return pc.Index("dine-nd-menu")

# URL of the published menu JSON
MENU_URL = os.getenv("MENU_URL", "https://arda-kurama.github.io/dine-nd/consolidated_menu.json")

def get_menu():
    """
    Fetch and parse the consolidated menu from MENU_URL.
    """
    with urlopen(MENU_URL) as r:
        return json.load(r)

# Load the same section definitions used by the mobile app
BASE_DIR = os.path.dirname(__file__)
JSON_PATH = os.path.join(BASE_DIR, "..", "mobile-app", "src", "components", "section_defs.json")
with open(JSON_PATH) as fp:
    raw_defs = json.load(fp)
SECTION_DEFS = [(d["title"], re.compile(d["pattern"])) for d in raw_defs]

# Utility functions
def parse_num(x):
    """Extract an integer from strings like '78g' or return int(x)."""
    if isinstance(x, (int, float)):
        return int(x)
    if isinstance(x, str):
        m = re.search(r"\d+", x)
        return int(m.group()) if m else 0
    return 0

def score_plate(plate, targets):
    """
    Compute squared-error score and sums for a list of items.
    plate: list of dicts with macros
    targets: dict macro->target value
    Returns (score, sums_dict).
    """
    sums = {k: 0 for k in targets}
    # plate: list of tuples (item_dict, servings)
    for item, serv in plate:
        for k in sums:
            sums[k] += item.get(k, 0) * serv
    score = sum((sums[k] - targets[k])**2 for k in targets if targets[k] is not None)
    return score, sums

# Routes
@app.route("/", methods=["GET"])
def health():
    """
    Health check endpoint. Used by Zappa's deploy validation.
    Returns 200 OK if the server is running.
    """
    return jsonify(status="ok"), 200

@app.route("/sections", methods=["GET"])
def get_sections():
    """
    Given `hall` and `meal` query parameters, returns
    the list of section titles that apply based on categories.
    """
    hall = request.args.get("hall")
    meal = request.args.get("meal")
    MENU = get_menu()

    # Safely extract category keys or return an error
    try:
        cats = MENU["dining_halls"][hall][meal]["categories"].keys()
    except KeyError:
        return jsonify(error="unknown hall or meal"), 400

    # Return all sections that match at least one category name
    secs = [
      title
      for title, rx in SECTION_DEFS
      if any(rx.search(cat) for cat in cats)
    ]
    return jsonify(sections=secs), 200

@app.route("/plan-plate", methods=["POST"])
def plan_plate():
    """
    Generate a recommended plate hitting macro targets.
    1) Build a textual query with hall/meal/macros.
    2) Embed it with OpenAI.
    3) Query Pinecone for top items.
    4) Filter by allergies & selected sections.
    5) Prompt GPT-4 for a strict-JSON meal plan.
    """
    data = request.get_json(force=True)
    hall: str | None = data.get("hall")
    meal: str | None = data.get("meal")

    # Extract macro targets (may be None)
    targets = {
        "calories": data.get("calorieTarget") or 0,
        "protein":  data.get("proteinTarget") or 0,
        "carbs":    data.get("carbTarget") or 0,
        "fat":      data.get("fatTarget") or 0,
    }
    avoid = [a.lower() for a in data.get("avoidAllergies", [])]
    sections = data.get("sections", [])

    # Embed user query
    parts = [f"{meal} at {hall}"]
    for k, label in [("protein", "g protein"), ("carbs", "g carbs"), ("fat", "g fat"), ("calories", "kcal")]:
        if targets[k]: parts.append(f"{targets[k]}{label}")
    query_text = ", ".join(parts)
    openai = get_openai()
    user_vec = openai.embeddings.create(
        model="text-embedding-3-small", input=query_text
    ).data[0].embedding

    # Fetch candidates
    idx = get_pinecone_index()
    f = {"hall": hall, "meal": meal}
    if sections: f["section"] = {"$in": sections}
    if avoid:    f["allergens"] = {"$nin": avoid}
    resp = idx.query(vector=user_vec, top_k=50, filter=f, include_metadata=True)

    candidates = []
    for m in resp.get("matches", []):
        meta = m.metadata if hasattr(m, 'metadata') else m.get('metadata', {})
        dish = m.id.split("|")[-1].strip()
        candidates.append({
            "name": dish,
            "calories": parse_num(meta.get("calories", 0)),
            "protein":  parse_num(meta.get("protein", 0)),
            "carbs":    parse_num(meta.get("total_carbohydrate", 0)),
            "fat":      parse_num(meta.get("total_fat", 0)),
        })

    # Generate combos with up to 3 servings per item
    scored = []
    for r in (3, 4, 5):
        for combo in combinations(candidates, r):
            # assign 1, 2, or 3 servings each
            for servs in product([1, 2, 3], repeat=r):
                plate = list(zip(combo, servs))
                sc, sums = score_plate(plate, targets)
                scored.append({"plate": plate, "score": sc, "sums": sums})
    scored.sort(key=lambda x: x['score'])
    top_options = scored[:10]

    # Ask GPT to pick one tasty option
    schema = {"items": [{"name": "...", "servings": 1}],
              "totals": {k: 0 for k in targets}}
    options = [
        {"items": [{"name": itm['name'], "servings": serv} for itm, serv in opt['plate']],
         "totals": opt['sums']}
        for opt in top_options
    ]
    prompt = [
        "You are a meal-planning assistant.",
        "Choose the most cohesive and tasty plate from these options, each with items and exact macros.",
        json.dumps(options, indent=2),
        "Return only JSON in this exact schema:",
        json.dumps(schema, indent=2)
    ]
    chat = openai.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[
            {"role": "system", "content": "You are a nutrition-planning assistant."},
            {"role": "user", "content": "\n".join(prompt)},
        ],
    )
    try:
        choice = json.loads(chat.choices[0].message.content)
    except:
        return jsonify(error="Invalid JSON from GPT"), 500

    return jsonify(choice), 200


if __name__ == "__main__":
    # Local development server
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
