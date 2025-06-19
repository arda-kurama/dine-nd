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
from itertools import combinations

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
    for item in plate:
        for k in sums:
            sums[k] += item.get(k, 0)
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
    cal = data.get("calorieTarget")
    protein = data.get("proteinTarget")
    carbs = data.get("carbTarget")
    fat = data.get("fatTarget")

    # Allergy and section filters to avoid
    avoid: list[str] = [a.lower() for a in data.get("avoidAllergies", [])]
    sections = data.get("sections", [])

    # 1) Build the query string
    query_parts = [f"{meal} at {hall}"]
    if protein:
        query_parts.append(f"{protein}g protein")
    if carbs:
        query_parts.append(f"{carbs}g carbs")
    if fat:
        query_parts.append(f"{fat}g fat")
    if cal:
        query_parts.append(f"~{cal} kcal")
    query_text = ", ".join(query_parts)

    # 2) Create embedding for the query
    openai = get_openai()
    emb = openai.embeddings.create(model="text-embedding-3-small", input=query_text)
    user_vec = emb.data[0].embedding

    # Query Pinecone for raw candidates
    index = get_pinecone_index()
    pinecone_filter = {"hall": hall, "meal": meal}
    if sections:
        pinecone_filter["section"] = {"$in": sections}
    if avoid:
        pinecone_filter["allergens"] = {"$nin": avoid}
    resp = index.query(
        vector=user_vec,
        top_k=100,
        filter=pinecone_filter,
        include_metadata=True,
    )

    # Build candidate list with true macros
    candidates = []
    for match in resp.get("matches", []):
        meta = match.metadata if hasattr(match, 'metadata') else match.get('metadata', {})
        dish = match.id.split('|')[-1].strip()
        candidates.append({
            "name": dish,
            "calories": parse_num(meta.get('calories', 0)),
            "protein": parse_num(meta.get('protein', 0)),
            "carbs": parse_num(meta.get('total_carbohydrate', 0)),
            "fat": parse_num(meta.get('total_fat', 0)),
        })

    targets = {
        "calories": cal or 0,
        "protein": protein or 0,
        "carbs": carbs or 0,
        "fat": fat or 0,
    }

    # Generate all combos of 3-5 items, score them, and pick top 10
    scored = []
    for r in (3,4,5):
        for combo in combinations(candidates, r):
            score, sums = score_plate(combo, targets)
            scored.append({"items": combo, "sums": sums, "score": score})
    scored.sort(key=lambda x: x['score'])
    top_options = scored[:10]

    # Ask GPT to pick the most tasty among them
    schema = {"items": [{"name": "...", "servings": 1}],
              "totals": {k: 0 for k in targets}}
    prompt = [
        "You are a meal-planning assistant.",
        "From the following list of plate options (each with items and true macro totals), choose the one that looks most cohesive and tasty.",
        "Do NOT invent new items or modify names; pick one of the options exactly.",
        json.dumps([{"items":opt['items'], "totals": opt['sums']} for opt in top_options], indent=2),
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
    except Exception:
        return jsonify(error="Invalid JSON from GPT"), 500

    # Return GPT's selection (names, servings) with accurate totals
    return jsonify(choice), 200

if __name__ == "__main__":
    # Local development server
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
