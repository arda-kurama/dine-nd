"""endpoint.py – DineND meal‑planning back‑end

Flask API that powers the Plate‑Planner feature in the mobile app.
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
Highlights (vNEXT)
==================
• Case‑insensitive hall / meal / section look‑ups → no more missing dropdowns.
• Fractional servings (0.5‑2.0), 2‑4 items, ±10 % macro tolerance.
• Enumerate all feasible plates, let GPT pick the tastiest & most cohesive.
• Global error handler ⇒ JSON 400 / 422 / 503 / 500.

Environment variables
=====================
OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_ENV, PINECONE_INDEX_NAME, MENU_URL
(defaults provided below).
"""
from __future__ import annotations

import json, os, time, logging, urllib.error
from functools import lru_cache
from itertools import combinations
from typing import Any, Dict, List

import openai, pinecone, requests
from flask import Flask, jsonify, request
from werkzeug.exceptions import BadRequest

# ─── config ───────────────────────────────────────────────────────────────────
MENU_URL            = os.getenv("MENU_URL", "https://dine.nd.edu/api/combined-menu.json")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "dine-nd-menu")
GPT_MODEL           = os.getenv("GPT_MODEL", "gpt-4o-mini")
MENU_TTL_SECONDS    = 3600          # 1‑hour cache
SERVING_OPTIONS     = [0.5, 1.0, 1.5, 2.0]
MAX_GPT_PLATES      = 30            # cap plates sent to GPT
TOLERANCE           = 0.10          # ±10 % window

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)

# ─── custom error ─────────────────────────────────────────────────────────────
class InfeasiblePlateError(Exception):
    """Raised when no plate satisfies the macro & item constraints."""

# ─── helpers ──────────────────────────────────────────────────────────────────

def _ci_get(mapping: Dict[str, Any], key: str) -> Any | None:
    """Case‑insensitive .get() (one level)."""
    for k, v in mapping.items():
        if k.lower() == key.lower():
            return v
    return None


def safe_json(data: Dict[str, Any], key: str, default: Any | None = None):
    if key not in data and default is None:
        raise BadRequest(f"Missing required field: {key}")
    return data.get(key, default)

# ─── cached menu fetch ────────────────────────────────────────────────────────
_MENU_CACHE: dict[str, Any] | None = None
_MENU_CACHE_TS: float = 0

def get_menu() -> dict[str, Any]:
    global _MENU_CACHE, _MENU_CACHE_TS
    if _MENU_CACHE and time.time() - _MENU_CACHE_TS < MENU_TTL_SECONDS:
        return _MENU_CACHE
    logging.info("Downloading fresh menu JSON …")
    resp = requests.get(MENU_URL, timeout=10)
    resp.raise_for_status()
    _MENU_CACHE = resp.json()
    _MENU_CACHE_TS = time.time()
    return _MENU_CACHE

# ─── pinecone client (memoised) ───────────────────────────────────────────────
@lru_cache(maxsize=1)
def pc_index():
    pinecone.init(api_key=os.environ["PINECONE_API_KEY"], environment=os.getenv("PINECONE_ENV", "us-east1-gcp"))
    return pinecone.Index(PINECONE_INDEX_NAME)

# ─── GPT client (memoised) ────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def _openai_client():
    return openai.OpenAI()

# ─── GPT ranking helper ───────────────────────────────────────────────────────

def gpt_choose_plate(plates: List[List[dict]], hall: str, meal: str) -> List[dict]:
    if not plates:
        raise InfeasiblePlateError("No feasible plates to rank")
    client = _openai_client()
    plates = plates[:MAX_GPT_PLATES]
    sys_msg = (
        "You are an expert campus dining nutritionist and chef. Given multiple\n"
        "candidate plates that all satisfy a diner's macro targets, choose the ONE\n"
        "plate that will taste the best together and feel cohesive as a meal.\n"
        "Return ONLY that plate, as JSON array of item objects (name, servings,\n"
        "servingSize). Do NOT include any explanation or extra keys."
    )
    user_msg = json.dumps({"hall": hall, "meal": meal, "candidatePlates": plates}, indent=2)
    try:
        resp = client.chat.completions.create(
            model=GPT_MODEL,
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.4,
        )
        txt = resp.choices[0].message.content.strip()
        return json.loads(txt)
    except (json.JSONDecodeError, openai.OpenAIError) as e:
        logging.warning("GPT fallback – returning first plate (%s)", e)
        return plates[0]

# ─── plate enumeration helper ─────────────────────────────────────────────────

def generate_feasible_plates(items: List[dict], targets: Dict[str, float]) -> List[List[dict]]:
    feasible: List[List[dict]] = []
    enriched: List[dict] = []
    for idx, itm in enumerate(items):
        for s in SERVING_OPTIONS:
            enriched.append({
                **itm,
                "servings": s,
                "macros_adj": {k: v * s for k, v in itm["macros"].items()},
                "_id": idx,
            })

    for r in range(2, 5):
        for combo in combinations(enriched, r):
            if len({c["_id"] for c in combo}) != r:
                continue  # duplicate item names
            totals = {k: 0.0 for k in targets}
            for c in combo:
                for k in totals:
                    totals[k] += c["macros_adj"].get(k, 0.0)
            if all((1 - TOLERANCE) * targets[k] <= totals[k] <= (1 + TOLERANCE) * targets[k] for k in targets):
                feasible.append([
                    {"name": c["name"], "servings": c["servings"], "servingSize": c["serving_size"]}
                    for c in combo
                ])
                if len(feasible) >= MAX_GPT_PLATES:
                    return feasible
    return feasible

# ─── util: candidate extraction (no Pinecone for now) ─────────────────────────

def filter_menu_items(menu: dict[str, Any], hall: str, meal: str, sections: List[str], avoid: List[str]) -> List[dict]:
    hall_data = _ci_get(menu, hall) or {}
    meal_data = _ci_get(hall_data, meal) or {}
    selected_sections = [s.lower() for s in sections] if sections else [k.lower() for k in meal_data]
    items: List[dict] = []
    for sec_name, sec_items in meal_data.items():
        if sec_name.lower() not in selected_sections:
            continue
        for itm in sec_items:
            allergens = [a.lower() for a in itm.get("allergens", [])]
            if any(a in allergens for a in avoid):
                continue
            items.append(itm)
    return items

# ─── Flask global error handler ──────────────────────────────────────────────
@app.errorhandler(Exception)
def handle_any(err):
    code = 500
    if isinstance(err, BadRequest):
        code = 400
    elif isinstance(err, (
        openai.OpenAIError,
        pinecone.core.client.exceptions.ApiException,
        urllib.error.URLError,
        requests.RequestException,
    )):
        code = 503
    elif isinstance(err, InfeasiblePlateError):
        code = 422
    logging.exception("Unhandled error")
    return jsonify(error=str(err)), code

# ─── health check ────────────────────────────────────────────────────────────
@app.route("/")
def root():
    return "OK", 200

# ─── sections endpoint ───────────────────────────────────────────────────────
@app.route("/sections")
def sections():
    hall = request.args.get("hall", "")
    meal = request.args.get("meal", "")
    menu = get_menu()
    hall_dict = _ci_get(menu, hall) or {}
    meal_dict = _ci_get(hall_dict, meal) or {}
    return jsonify(sections=list(meal_dict.keys()))

# ─── main plate‑planner endpoint ─────────────────────────────────────────────
@app.route("/plan-plate", methods=["POST"])
def plan_plate():
    data = request.get_json(force=True)

    hall   = safe_json(data, "hall")
    meal   = safe_json(data, "meal")
    targets = {
        "calories": safe_json(data, "calorieTarget", 0),
        "protein":  safe_json(data, "proteinTarget", 0),
        "carbs":    safe_json(data, "carbTarget", 0),
        "fat":      safe_json(data, "fatTarget", 0),
    }
    sections = [s.strip() for s in data.get("sections", [])]
    avoid    = [a.lower() for a in data.get("avoidAllergies", [])]

    # 1) get menu items filtered by hall/meal/section/allergy
    menu     = get_menu()
    candidates = filter_menu_items(menu, hall, meal, sections, avoid)
    if not candidates:
        raise InfeasiblePlateError("No menu items match your filters")

    # 2) enumerate all feasible plates within tolerance & size rules
    feasible = generate_feasible_plates(candidates, targets)
    if not feasible:
        raise InfeasiblePlateError("Cannot satisfy macro targets ±10 % with current filters")

    # 3) let GPT choose the tastiest plate
    choice = gpt_choose_plate(feasible, hall, meal)

    # 4) compute totals for the chosen plate
    totals = {k: 0.0 for k in targets}
    # build lookup
    lookup = {
        (itm["name"].lower(), itm["serving_size"].lower()): itm["macros"]
        for itm in candidates
    }
    for itm in choice:
        key = (itm["name"].lower(), itm["servingSize"].lower())
        base = lookup.get(key)
        if not base:
            continue  # shouldn’t happen
        for k in totals:
            totals[k] += base.get(k, 0) * itm["servings"]

    return jsonify({"items": choice, "totals": totals}), 200

# ─── main guard ----------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8080)), debug=False)
