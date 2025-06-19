"""endpoint.py - DineND meal-planning back-end

Flask API that powers the Plate-Planner feature in the mobile app.
------------------------------------------------------------------
Highlights of this version
==========================
• Same HTTP interface as before → **no front-end changes required**.
• Fractional servings: **0.5, 1.0, 1.5, 2.0**.
• Exactly **2 - 4 distinct dishes** per plate; no duplicate rows.
• ±10 % tolerance band on Calories / Protein / Carbs / Fat.
• **All** feasible plates are enumerated (within a sane search cap) and sent
  to GPT-4o-mini, which picks the tastiest & most cohesive one.
• Structured JSON error responses instead of raw 500s.

Make sure these env vars are set in prod:
  OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_ENV, PINECONE_INDEX_NAME,
  MENU_URL (defaults provided below).
"""
from __future__ import annotations

import json, os, time, logging, urllib.error
from functools import lru_cache
from itertools import combinations, product
from typing import Any, Dict, List

import openai, pinecone, requests
from flask import Flask, jsonify, request
from werkzeug.exceptions import BadRequest

# ─── config ───────────────────────────────────────────────────────────────────
MENU_URL              = os.getenv("MENU_URL", "https://dine.nd.edu/api/combined-menu.json")
PINECONE_INDEX_NAME   = os.getenv("PINECONE_INDEX_NAME", "dine-nd-menu")
GPT_MODEL             = os.getenv("GPT_MODEL", "gpt-4o-mini")
MENU_TTL_SECONDS      = 3600  # 1‑hour cache for menu JSON
SERVING_OPTIONS       = [0.5, 1.0, 1.5, 2.0]
MAX_GPT_PLATES        = 30    # safety cap to avoid giant prompts
TOL                   = 0.10  # ±10 % macro window

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)

# ─── custom error for unsatisfiable requests ─────────────────────────────────
class InfeasiblePlateError(Exception):
    """Raised when no plate satisfies the macro & item constraints."""

# ─── utils ────────────────────────────────────────────────────────────────────

def safe_json(data: Dict[str, Any], key: str, default: Any | None = None):
    if key not in data and default is None:
        raise BadRequest(f"Missing required field: {key}")
    return data.get(key, default)

# ─── cached menu fetch ────────────────────────────────────────────────────────
_MENU_CACHE: dict[str, Any] | None = None
_MENU_CACHE_TIME: float = 0

def get_menu() -> dict[str, Any]:
    global _MENU_CACHE, _MENU_CACHE_TIME
    if _MENU_CACHE and time.time() - _MENU_CACHE_TIME < MENU_TTL_SECONDS:
        return _MENU_CACHE
    logging.info("Downloading fresh menu JSON …")
    resp = requests.get(MENU_URL, timeout=10)
    resp.raise_for_status()
    _MENU_CACHE   = resp.json()
    _MENU_CACHE_TIME = time.time()
    return _MENU_CACHE

# ─── pinecone client (memoised) ───────────────────────────────────────────────
@lru_cache(maxsize=1)
def pc_index():
    pinecone.init(api_key=os.environ["PINECONE_API_KEY"], environment=os.getenv("PINECONE_ENV", "us-east1-gcp"))
    return pinecone.Index(PINECONE_INDEX_NAME)

# ─── GPT helpers (memoised) ───────────────────────────────────────────────────
@lru_cache(maxsize=1)
def _openai_client():
    return openai.OpenAI()

def gpt_choose_plate(plates: List[List[dict]], hall: str, meal: str) -> List[dict]:
    """Ask GPT to pick the tastiest & most cohesive plate from list."""
    client = _openai_client()
    # shrink the prompt if we exceeded the cap
    plates = plates[:MAX_GPT_PLATES]
    sys_msg = ("You are an expert campus dining nutritionist and chef. Given multiple\n"
               "candidate plates that all satisfy a diner's macro targets, choose the\n"
               "ONE plate that will taste the best together and feel cohesive as a meal.\n"
               "Return ONLY that plate, as JSON array of item objects (name, servings,\n"
               "servingSize). Do NOT include any explanation or extra keys.")
    user_msg = json.dumps({"hall": hall, "meal": meal, "candidatePlates": plates}, indent=2)
    try:
        resp = client.chat.completions.create(
            model=GPT_MODEL,
            messages=[{"role": "system", "content": sys_msg}, {"role": "user", "content": user_msg}],
            temperature=0.4
        )
        txt = resp.choices[0].message.content.strip()
        return json.loads(txt)  # type: ignore[arg-type]
    except (json.JSONDecodeError, openai.OpenAIError) as e:
        logging.warning("GPT fallback – returning first plate (%s)", e)
        return plates[0]

# ─── plate‑enumeration helper ─────────────────────────────────────────────────

def generate_feasible_plates(items: List[dict], targets: Dict[str, float]) -> List[List[dict]]:
    """Brute‑force enumerate 2‑4‑item plates within ±TOL of each macro."""
    feasible: List[List[dict]] = []
    n = len(items)
    # Pre‑compute macros * per serving‑option
    enriched: List[dict] = []
    for i, itm in enumerate(items):
        for s in SERVING_OPTIONS:
            new = itm.copy()
            new["servings"]    = s
            new["macros_adj"] = {k: v * s for k, v in itm["macros"].items()}
            new["_id"] = i      # keep original index for uniqueness
            enriched.append(new)

    for r in range(2, 5):  # 2–4 items
        for combo in combinations(enriched, r):
            # ensure unique dish indices (no dup with diff serving)
            ids = {c["_id"] for c in combo}
            if len(ids) != r:
                continue
            totals = {k: 0.0 for k in targets}
            for c in combo:
                for k in totals:
                    totals[k] += c["macros_adj"].get(k, 0.0)
            if all(0.9*targets[k] <= totals[k] <= 1.1*targets[k] for k in targets):
                plate_items = [{"name": c["name"],
                                "servings": c["servings"],
                                "servingSize": c["serving_size"]} for c in combo]
                feasible.append(plate_items)
                if len(feasible) >= MAX_GPT_PLATES:
                    return feasible
    return feasible

# ─── Flask global error handler ───────────────────────────────────────────────
@app.errorhandler(Exception)
def handle_any(err):
    code = 500
    if isinstance(err, BadRequest):
        code = 400
    elif isinstance(err, (openai.OpenAIError,
                          pinecone.core.client.exceptions.ApiException,
                          urllib.error.URLError,
                          requests.RequestException)):
        code = 503
    elif isinstance(err, InfeasiblePlateError):
        code = 422
    logging.exception("Unhandled error")
    return jsonify(error=str(err)), code

# ─── health check ────────────────────────────────────────────────────────────
@app.route("/")
def root():
    return "OK", 200

# ─── sections endpoint (unchanged) ───────────────────────────────────────────
@app.route("/sections")
def sections():
    hall = request.args.get("hall", "")
    meal = request.args.get("meal", "")
    menu = get_menu()
    data = menu.get(hall, {}).get(meal, {})
    return jsonify(sections=list(data.keys()))

# ─── main plate‑planner endpoint ─────────────────────────────────────────────
@app.route("/plan-plate", methods=["POST"])
def plan_plate():
    payload = request.get_json(force=True)

    hall   = safe_json(payload, "hall")
    meal   = safe_json(payload, "meal")
    targets = {
        "calories": safe_json(payload, "calorieTarget", 0),
        "protein":  safe_json(payload, "proteinTarget",  0),
        "carbs":    safe_json(payload, "carbTarget",     0),
        "fat":      safe_json(payload, "fatTarget",      0),
    }
    avoid    = [a.lower() for a in payload.get("avoidAllergies", [])]
    sections = payload.get("sections", [])

    # 1) candidate retrieval via pinecone (or fall back to all items in hall‑meal)
    try:
        menu = get_menu()
    except Exception as e:
        raise RuntimeError("Menu fetch failed") from e

    hall_data = menu.get(hall, {}).get(meal, {})
    if not hall_data:
        raise BadRequest("Invalid hall or meal name")

    candidates: List[dict] = []
    for sec, lst in hall_data.items():
        if sections and sec not in sections:
            continue
        for itm in lst:
            if any(a in itm["allergens"].lower() for a in avoid):
                continue
            candidates.append(itm)

    if len(candidates) < 2:
        raise InfeasiblePlateError("Not enough menu items after filters")

    # 2) enumerate *all* plates that satisfy macros ±10 %
    feasible = generate_feasible_plates(candidates, targets)
    if not feasible:
        raise InfeasiblePlateError("Cannot satisfy macro targets ±10 % with 2‑4 items")

    # 3) ask GPT to pick the tastiest / most cohesive
    chosen_items = gpt_choose_plate(feasible, hall, meal)

    # 4) compute totals for outer schema
    totals = {k: 0.0 for k in targets}
    for itm in chosen_items:
        # find original macros for precise total
        base = next(x for x in candidates if x["name"] == itm["name"])
        for k in totals:
            totals[k] += base["macros"].get(k, 0.0) * itm["servings"]

    return jsonify({"items": chosen_items, "totals": totals}), 200

# ─── run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
