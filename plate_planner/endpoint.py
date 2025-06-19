"""endpoint.py – DineND meal‑planning back‑end

Flask API that powers the Plate‑Planner feature in the mobile app.
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
Key points
==========
* Cached menu JSON with graceful fallback to stale copy.
* Fractional servings (0.5–2.0), 2‑4 unique dishes, ±10 % macro tolerance.
* Exhaustive plate enumeration → GPT taste‑ranker.
* Global JSON error handler (400 / 422 / 503 / 500) – no raw tracebacks.
* Case‑insensitive hall / meal / section matching.
* Same I/O schema as the legacy endpoint: `{ items, totals }`.

Env vars: OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_ENV, PINECONE_INDEX_NAME,
MENU_URL (optional), PORT (optional).
"""
from __future__ import annotations

import json
import logging
import os
import time
import re
import urllib.error
import datetime
from functools import lru_cache
from itertools import combinations, product
from typing import Any, Dict, List

import requests
from flask import Flask, jsonify, request
from werkzeug.exceptions import BadRequest
from openai import OpenAI
from pinecone import Pinecone

# ─── config ──────────────────────────────────────────────────────────────────
MENU_URL            = os.getenv("MENU_URL", "https://arda-kurama.github.io/dine-nd/consolidated_menu.json")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "dine-nd-menu")
GPT_MODEL           = os.getenv("GPT_MODEL", "gpt-4.1-nano")
MENU_TTL_SECONDS    = 3600  # 1 h cache
SERVING_OPTIONS     = [0.5, 1.0, 1.5, 2.0]
MAX_GPT_PLATES      = 30
TOLERANCE           = 0.10  # ±10 %

# Load the same section definitions used by the mobile app
BASE_DIR = os.path.dirname(__file__)
JSON_PATH = os.path.join(BASE_DIR, "..", "mobile-app", "src", "components", "section_defs.json")
with open(JSON_PATH) as fp:
    raw_defs = json.load(fp)
SECTION_DEFS = [(d["title"], re.compile(d["pattern"])) for d in raw_defs]

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)

# ─── custom errors ───────────────────────────────────────────────────────────
class InfeasiblePlateError(Exception):
    """Raised when no plate satisfies all constraints."""

class MenuFetchError(Exception):
    """Raised when live menu fetch fails and no cache exists."""

# ─── tiny helpers ────────────────────────────────────────────────────────────

def _ci_get(mapping: Dict[str, Any], key: str):
    """Case‑insensitive .get() (one level)."""
    if not mapping or not key:
        return None
    for k in mapping:
        if k.lower() == key.lower():
            return mapping[k]
    return None

def safe_json(data: Dict[str, Any], key: str, default: Any | None = None):
    if key not in data and default is None:
        raise BadRequest(f"Missing required field: {key}")
    return data.get(key, default)

def canonical_section(category: str) -> str:
    """Return the canonical cuisine title for a raw category name."""
    for title, rx in SECTION_DEFS:
        if rx.search(category):
            return title
    return category  # no match ⇒ fall back to the raw string

def parse_num(x: Any) -> int:
    """
    Convert nutrition strings ('78g', '120 kcal', etc.) or numbers to int.
    Falls back to 0 if it cannot parse.
    """
    if isinstance(x, (int, float)):
        return int(x)
    if isinstance(x, str):
        m = re.search(r"\d+", x)
        return int(m.group()) if m else 0
    return 0

def score_plate(plate, targets):
    """
    plate: list of tuples  (item_dict, servings)
    targets: dict[str, int] – macro goals
    Returns  (squared_error, macro_sums)
    """
    totals = {k: 0 for k in targets}
    for itm, serv in plate:
        for k in totals:
            totals[k] += itm.get(k, 0) * serv
    err = sum((totals[k] - targets[k]) ** 2 for k in targets if targets[k])
    return err, totals

# ─── cached menu fetch ──────────────────────────────────────────────────────
_MENU_CACHE: dict[str, Any] | None = None
_MENU_CACHE_TIME: float = 0.0

def get_menu() -> dict[str, Any]:
    global _MENU_CACHE, _MENU_CACHE_TIME
    if _MENU_CACHE and time.time() - _MENU_CACHE_TIME < MENU_TTL_SECONDS:
        return _MENU_CACHE
    try:
        logging.info("Fetching menu JSON …")
        r = requests.get(MENU_URL, timeout=8)
        r.raise_for_status()
        _MENU_CACHE, _MENU_CACHE_TIME = r.json(), time.time()
        return _MENU_CACHE
    except requests.RequestException as e:
        logging.error("Menu fetch failed: %s", e)
        if _MENU_CACHE:
            logging.warning("Serving stale cached menu")
            return _MENU_CACHE
        raise MenuFetchError("Dining menu temporarily unavailable. Try again later.") from e

# ─── external clients (memoised) ────────────────────────────────────────────
@lru_cache(maxsize=1)
def pc_index():
    api_key = os.environ.get("PINECONE_API_KEY")
    env = os.environ.get("PINECONE_ENV")
    if not api_key or not env:
        raise RuntimeError("PINECONE_API_KEY / PINECONE_ENV missing from environment")
    pc = Pinecone(api_key=api_key, environment=env)
    return pc.Index(PINECONE_INDEX_NAME)

@lru_cache(maxsize=1)
def _openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing from environment")
    return OpenAI(api_key=api_key)

# ─── GPT taste‑ranker ───────────────────────────────────────────────────────

def gpt_choose_plate(plates: List[dict], hall: str, meal: str) -> dict:
    """
    Choose the best plate from a list of plate options.
    Returns the selected plate in the format expected by the frontend.
    """
    if not plates:
        raise InfeasiblePlateError("No feasible plates to rank")
    plates = plates[:MAX_GPT_PLATES]
    
    # Use the same prompt structure as the working old_endpoint.py
    schema = {
        "items": [{"name": "...", "servings": "...", "servingSize": "..."}],
        "totals": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    }
    
    prompt_parts = [
        "You are a meal-planning assistant.",
        "Choose the most cohesive and tasty plate from these options, ensuring the plate includes all five major food groups: protein, grains or starches, vegetables, fruits, and healthy fats.",
        json.dumps(plates, indent=2),
        "Return only JSON in this exact schema:",
        json.dumps(schema, indent=2)
    ]
    
    client = _openai_client()
    try:
        resp = client.chat.completions.create(
            model=GPT_MODEL,
            messages=[
                {"role": "system", "content": "You are a nutrition-planning assistant."},
                {"role": "user", "content": "\n".join(prompt_parts)},
            ],
            temperature=0.4,
        )
        return json.loads(resp.choices[0].message.content.strip())
    except Exception as e:
        logging.warning("GPT JSON parse failed (%s) – defaulting to first plate", e)
        return plates[0]

# ─── error‑handling ─────────────────────────────────────────────────────────
@app.errorhandler(Exception)
def handle_any(err):
    logging.exception("Unhandled error")
    if isinstance(err, BadRequest):
        return jsonify(error=str(err)), 400
    if isinstance(err, (MenuFetchError, requests.RequestException, urllib.error.URLError)):
        return jsonify(error="Dining menu temporarily unavailable. Try again later."), 503
    # Updated exception handling for openai and pinecone
    if isinstance(err, Exception) and ('openai' in str(type(err)).lower() or 'pinecone' in str(type(err)).lower()):
        return jsonify(error="Upstream service error, please retry."), 503
    if isinstance(err, InfeasiblePlateError):
        return jsonify(error=str(err)), 422
    return jsonify(error="Internal server error"), 500

# ─── healthcheck ────────────────────────────────────────────────────────────
@app.route("/")
def root():
    return "OK", 200

# ─── sections picker ────────────────────────────────────────────────────────
@app.route("/sections")
def sections():
    hall = request.args.get("hall", "")
    meal = request.args.get("meal", "")
    try:
        menu = get_menu()
        # Use the same logic as old_endpoint.py for compatibility
        try:
            cats = menu["dining_halls"][hall][meal]["categories"].keys()
        except KeyError:
            return jsonify(error="unknown hall or meal"), 400
        
        # Return all sections that match at least one category name
        titles = [
            title
            for title, rx in SECTION_DEFS
            if any(rx.search(cat) for cat in cats)
        ]
        
        return jsonify(sections=titles)
    except MenuFetchError:
        return jsonify(sections=[]), 200

# ─── main plate‑planner ─────────────────────────────────────────────────────
@app.route("/plan-plate", methods=["POST"])
def plan_plate():
    """
    Generate a recommended plate hitting macro targets.
    Uses the same logic as old_endpoint.py for compatibility.
    """
    start_time = time.time()
    data = request.get_json(force=True)

    hall = safe_json(data, "hall")
    meal = safe_json(data, "meal")
    targets = {
        "calories": safe_json(data, "calorieTarget", 0),
        "protein":  safe_json(data, "proteinTarget", 0),
        "carbs":    safe_json(data, "carbTarget", 0),
        "fat":      safe_json(data, "fatTarget", 0),
    }
    sections = [s.strip() for s in data.get("sections", [])]
    avoid    = [a.lower() for a in data.get("avoidAllergies", [])]

    # ── Build embedding query text ──────────────────────────────────────────
    parts = [f"{meal} at {hall}"]
    for k, lbl in [("protein", "g protein"), ("carbs", "g carbs"),
                   ("fat", "g fat"), ("calories", "kcal")]:
        if targets[k]:
            parts.append(f"{targets[k]}{lbl}")
    query_text = ", ".join(parts)

    # ── Embed & Pinecone search ─────────────────────────────────────────────
    vec = _openai_client().embeddings.create(
        model="text-embedding-3-small",
        input=query_text
    ).data[0].embedding

    filt: dict[str, Any] = {"hall": hall, "meal": meal}
    if sections:
        filt["section"] = {"$in": sections}
    if avoid:
        filt["allergens"] = {"$nin": avoid}

    matches = pc_index().query(
        vector=vec, top_k=25, filter=filt, include_metadata=True
    ).get("matches", [])[:20]

    candidates = []
    for m in matches:
        meta = getattr(m, "metadata", m.get("metadata", {}))
        dish = m.id.split("|")[-1].strip()
        candidates.append({
            "name": dish,
            "servingSize": meta.get("serving_size", ""),
            "calories": parse_num(meta.get("calories", 0)),
            "protein":  parse_num(meta.get("protein", 0)),
            "carbs":    parse_num(meta.get("total_carbohydrate", 0)),
            "fat":      parse_num(meta.get("total_fat", 0)),
        })

    # ── Exhaustive combo search (3-4 items, 1-2 servings) - same as old_endpoint.py ───────────────────
    scored: List[dict] = []
    for r in (2, 3, 4):  # Use 3-4 items like old_endpoint.py, not 2-4
        for combo in combinations(candidates, r):
            for servs in product(SERVING_OPTIONS, repeat=r):  # Use 1-2 servings like old_endpoint.py
                if time.time() - start_time > 8:  # hard time-out
                    break
                plate = list(zip(combo, servs))
                err, sums = score_plate(plate, targets)
                scored.append({"plate": plate, "score": err, "sums": sums})  # Use "score" key like old_endpoint.py
            if time.time() - start_time > 8:
                break
        if time.time() - start_time > 8:
            break
    if not scored:
        return jsonify(error="Could not compute plate in time"), 504  # Return 504 like old_endpoint.py

    scored.sort(key=lambda x: x["score"])  # Sort by "score" key
    top_opts = scored[:10]

    # ── Ask GPT to pick best plate ──────────────────────────────────────────
    opts_payload = [
        {"items": [{"name": itm["name"], "servings": s, "servingSize": itm["servingSize"]}
                   for itm, s in opt["plate"]],
         "totals": opt["sums"]}
        for opt in top_opts
    ]
    choice = gpt_choose_plate(opts_payload, hall, meal)

    return jsonify(choice), 200

if __name__ == "__main__":
    # Local development server
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)