"""endpoint.py – DineND meal‑planning back‑end

Flask API that powers the Plate‑Planner feature in the mobile app.
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
Key points
==========
* Cached menu JSON with graceful fallback to stale copy.
* Fractional servings (0.5–2.0), 2‑4 unique dishes, ±10 % macro tolerance.
* Exhaustive plate enumeration → GPT taste‑ranker.
* Global JSON error handler (400 / 422 / 503 / 500) – no raw tracebacks.
* Case‑insensitive hall / meal / section matching.
* Same I/O schema as the legacy endpoint: `{ items, totals }`.

Env vars: OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_ENV, PINECONE_INDEX_NAME,
MENU_URL (optional), PORT (optional).
"""
from __future__ import annotations

import json, logging, os, time, urllib.error
from functools import lru_cache
from itertools import combinations
from typing import Any, Dict, List

import openai, pinecone, requests
from flask import Flask, jsonify, request
from werkzeug.exceptions import BadRequest

# ─── config ──────────────────────────────────────────────────────────────────
MENU_URL            = os.getenv("MENU_URL", "https://dine.nd.edu/api/combined-menu.json")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "dine-nd-menu")
GPT_MODEL           = os.getenv("GPT_MODEL", "gpt-4o-mini")
MENU_TTL_SECONDS    = 3600  # 1 h cache
SERVING_OPTIONS     = [0.5, 1.0, 1.5, 2.0]
MAX_GPT_PLATES      = 30
TOLERANCE           = 0.10  # ±10 %

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
    for k in mapping:
        if k.lower() == key.lower():
            return mapping[k]
    return None

def safe_json(data: Dict[str, Any], key: str, default: Any | None = None):
    if key not in data and default is None:
        raise BadRequest(f"Missing required field: {key}")
    return data.get(key, default)

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
    pinecone.init(api_key=os.environ.get("PINECONE_API_KEY"), environment=os.getenv("PINECONE_ENV", "us-east1-gcp"))
    return pinecone.Index(PINECONE_INDEX_NAME)

@lru_cache(maxsize=1)
def _openai_client():
    return openai.OpenAI()

# ─── GPT taste‑ranker ───────────────────────────────────────────────────────

def gpt_choose_plate(plates: List[List[dict]], hall: str, meal: str) -> List[dict]:
    if not plates:
        raise InfeasiblePlateError("No feasible plates to rank")
    plates = plates[:MAX_GPT_PLATES]
    system = (
        "You are an expert campus dining nutritionist and chef. Given multiple "
        "candidate plates that all satisfy a diner's macro targets, choose the ONE "
        "plate that will taste the best together and feel cohesive as a meal. "
        "Return ONLY that plate as JSON array of items (name, servings, servingSize)."
    )
    prompt = json.dumps({"hall": hall, "meal": meal, "candidates": plates}, indent=2)
    client = _openai_client()
    try:
        resp = client.chat.completions.create(
            model=GPT_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return json.loads(resp.choices[0].message.content.strip())
    except (openai.OpenAIError, json.JSONDecodeError) as e:
        logging.warning("GPT JSON parse failed (%s) – defaulting to first plate", e)
        return plates[0]

# ─── brute‑force enumeration ────────────────────────────────────────────────

def generate_feasible_plates(items: List[dict], targets: Dict[str, float]) -> List[List[dict]]:
    enriched: List[dict] = []
    for idx, itm in enumerate(items):
        for s in SERVING_OPTIONS:
            enriched.append({
                **itm,
                "servings": s,
                "_uid": idx,
                "macros_adj": {k: v * s for k, v in itm["macros"].items()},
            })

    feasible: List[List[dict]] = []
    for r in range(2, 5):
        for combo in combinations(enriched, r):
            if len({c["_uid"] for c in combo}) < r:
                continue  # duplicate dish
            totals = {k: sum(c["macros_adj"].get(k, 0.0) for c in combo) for k in targets}
            if all((1 - TOLERANCE) * targets[k] <= totals[k] <= (1 + TOLERANCE) * targets[k] for k in targets):
                feasible.append([
                    {"name": c["name"], "servings": c["servings"], "servingSize": c["serving_size"]}
                    for c in combo
                ])
                if len(feasible) >= MAX_GPT_PLATES:
                    return feasible
    return feasible

# ─── error‑handling ─────────────────────────────────────────────────────────
@app.errorhandler(Exception)
def handle_any(err):
    logging.exception("Unhandled error")
    if isinstance(err, BadRequest):
        return jsonify(error=str(err)), 400
    if isinstance(err, (MenuFetchError, requests.RequestException, urllib.error.URLError)):
        return jsonify(error="Dining menu temporarily unavailable. Try again later."), 503
    if isinstance(err, (openai.OpenAIError, pinecone.core.client.exceptions.ApiException)):
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
    except MenuFetchError:
        return jsonify(sections=[]), 200
    hall_dict = _ci_get(menu, hall) or {}
    meal_dict = _ci_get(hall_dict, meal) or {}
    return jsonify(sections=list(meal_dict.keys()))

# ─── main plate‑planner ─────────────────────────────────────────────────────
@app.route("/plan-plate", methods=["POST"])
def plan_plate():
    data = request.get_json(force=True)

    hall = safe_json(data, "hall")
    meal = safe_json(data, "meal")
    targets = {
        "calories": safe_json(data, "calorieTarget", 0.0),
        "protein":  safe_json(data, "proteinTarget", 0.0),
        "carbs":    safe_json(data, "carbTarget", 0.0),
        "fat":      safe_json(data, "fatTarget", 0.0),
    }
    sections = [s.strip().lower() for s in data.get("sections", [])]  # optional cuisine filter
    avoid    = [a.lower() for a in data.get("avoidAllergies", [])]    # optional allergy filter

    # ── pull & validate menu slice ───────────────────────────────────────────
    menu = get_menu()
    hall_dict = _ci_get(menu, hall)
    if hall_dict is None:
        raise BadRequest(f"Unknown dining hall: {hall}")
    meal_dict = _ci_get(hall_dict, meal)
    if meal_dict is None:
        raise BadRequest(f"Unknown meal: {meal}")

    # Flatten menu items: { section: [ {name, macros, serving_size, allergens}, … ] }
    items: List[dict] = []
    for sec_name, dishes in meal_dict.items():
        if sections and sec_name.lower() not in sections:
            continue
        for d in dishes:
            # skip if any avoided allergen appears in this dish’s allergen list
            if avoid and any(a in (d.get("allergens") or "").lower() for a in avoid):
                continue
            items.append(
                {
                    "name": d["name"],
                    "macros": {
                        "calories": d.get("calories", 0.0),
                        "protein":  d.get("protein", 0.0),
                        "carbs":    d.get("carbs", 0.0),
                        "fat":      d.get("fat", 0.0),
                    },
                    "serving_size": d.get("serving_size", ""),
                }
            )

    if not items:
        raise InfeasiblePlateError("No dishes match your section / allergy filters.")

    # ── build & rank plates ─────────────────────────────────────────────────
    plates = generate_feasible_plates(items, targets)
    if not plates:
        raise InfeasiblePlateError("Could not find any plate within ±10 % of targets.")

    choice = gpt_choose_plate(plates, hall, meal)

    # compute totals for response
    totals = {k: 0.0 for k in targets}
    name_to_item = {(i["name"], i["serving_size"]): i for i in items}
    for c in choice:
        base = name_to_item.get((c["name"], c["servingSize"]), None)
        if base:
            for k in totals:
                totals[k] += base["macros"][k] * c["servings"]

    return jsonify({"items": choice, "totals": totals}), 200

if __name__ == "__main__":
    # Local development server
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)

