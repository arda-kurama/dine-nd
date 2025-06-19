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

def parse_num(x):
    if isinstance(x, (int, float)):
        return int(x)
    if isinstance(x, str):
        m = re.search(r"\d+", x)
        return int(m.group()) if m else 0
    return 0

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
    avoid: list[str] = data.get("avoidAllergies", [])
    sections = data.get("sections", [])

    # lowercase everything for consistent substring matching
    avoid_lower = [a.lower() for a in avoid]

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

    # 3) Retrieve similar items from Pinecone
    index = get_pinecone_index()
    pinecone_filter = {
    "hall": hall,
    "meal": meal,
    }

    # If a section or allergen is selected, include it in the filter
    if avoid_lower:
        pinecone_filter["allergens"] = {"$nin": avoid_lower}
    if sections:
        pinecone_filter["section"] = {"$in": sections}

    resp = index.query(
        vector=user_vec,
        top_k=50,
        filter=pinecone_filter,
        include_metadata=True,
    )

    # 4) Filter out unwanted items
    matches: list[dict] = []
    for m in resp.get("matches", []):
        meta = getattr(m, "metadata", {}) or {}

        # Normalize scraped allergens
        item_allergens = [a.lower() for a in meta.get("allergens", [])]

        # Skip if any avoided allergy is present
        if any(a.lower() in item_allergens for a in avoid):
            continue

        # Collect the match data
        matches.append({
            **meta,
            "id": getattr(m, "id", None),
            "score": getattr(m, "score", None),
            "values": getattr(m, "values", getattr(m, "vector", None)),
            "allergens": item_allergens,
        })

    # 5) Build a string-JSON prompt for GPT
    schema = {
        "items": [{"name": "...", "servings": 1}],
        "totals": {k: 0 for k in ("calories", "protein", "carbs", "fat")},
    }
    prompt_lines = [
        "You are a meal-planning assistant.",
        
        # Lock item names to metadata
        "Do NOT modify the 'name' field. Use the exact string provided—no changes, no notes, no parentheses, no rewording.",
        "Calculate each macro total by summing the 'calories', 'protein', 'carbs', and 'fat' fields of each item in the JSON array exactly. Do not estimate—use only the provided numeric fields.",
        "Make sure you do all arithmitic carefully, correctly, and accurately.",

        # Reccomend well-balanced meals
        "Build each plate to be both nutritionally balanced and enjoyable to eat.",
        "Each plate should include 3-5 distinct items that together represent all five major food groups: protein, grains or starches, vegetables, fruits, and healthy fats.",
        "Favor variety in color, texture, and flavor—combine crunchy and soft, savory and fresh, warm and cold items when appropriate.",

        # Loosen macro targetting for better reccomendations
        "Match calorie and macronutrient targets as closely as possible, ideally within ±10%. Never exceed targets by more than 15%.",
        "Use at most 2 servings per item; prefer 1 serving unless more is clearly needed to meet a target.",

        # Filtering logic
        f"Exclude any items that contain these allergens: {', '.join(avoid)}.",
        f"Include only items from these sections: {', '.join(sections)}.",

        # Optimize selections
        "Avoid redundant items—no duplicates or multiple items from the same category unless needed.",
        "Favor items with higher nutrient density and fewer empty calories.",

        # Fail gracefully
        "If you cannot meet all macro targets using the available items, return the best approximation.",

        # Candidate items list
        "\nHere are your available food items:",
        json.dumps(matches, indent=2),
        "\nTargets:",
    ]
    if cal:
        prompt_lines.append(f"- Calories: {cal}")
    if protein:
        prompt_lines.append(f"- Protein: {protein}g")
    if carbs:
        prompt_lines.append(f"- Carbohydrates: {carbs}g")
    if fat:
        prompt_lines.append(f"- Fat: {fat}g")
    
    # Enforce JSON-only response
    prompt_lines.append(
        "\nReturn *only* JSON in this exact schema (no prose):\n" +
        json.dumps(schema, indent=2)
    )

    chat = openai.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[
            {"role": "system", "content": "You are a nutrition-planning assistant."},
            {"role": "user", "content": "\n".join(prompt_lines)},
        ],
    )

    # 6) Parse GPT’s JSON plan
    result_text = chat.choices[0].message.content.strip()
    plan = json.loads(result_text)

    # 7) Build a lookup of true nutrition by BOTH id and dishName
    nutrition_map: dict[str, dict[str,int]] = {}
    for m in matches:
        full_id = m["id"]
        dish    = full_id.split("|")[-1].strip()

        nut = {
            "calories": parse_num(m.get("calories", 0)),
            "protein":  parse_num(m.get("protein", "0")),
            "carbs":    parse_num(m.get("total_carbohydrate", "0")),
            "fat":      parse_num(m.get("total_fat", "0")),
        }
        nutrition_map[full_id] = nut
        nutrition_map[dish]   = nut

    # 8) Recompute totals exactly
    true_totals = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    for item in plan.get("items", []):
        name     = item.get("name", "")
        servings = item.get("servings", 1)
        # lookup by full id or fallback to plain name
        nut = nutrition_map.get(name) or nutrition_map.get(name.split("|")[-1].strip(), {})
        for macro in true_totals:
            true_totals[macro] += nut.get(macro, 0) * servings

    # 9) Overwrite the potentially GPT‐hallucinated totals with our exact sums
    plan["totals"] = true_totals

    # 10) For debugging: include the raw Pinecone matches
    debug_match = matches[0] if matches else None
    plan["debug_match"] = debug_match
    return jsonify(plan), 200

if __name__ == "__main__":
    # Local development server
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
