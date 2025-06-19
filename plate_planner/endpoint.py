"""
Flask API for DineND meal planning.

Provides:
  - Health check at `/`
  - Section listing for a given hall & meal at `/sections`
  - Plate planning (macro-based) at `/plan-plate`
    which queries Pinecone, ILP solver, and GPT-4 for a balanced, tasty meal.
"""

import os
import time
import json
import re
import functools
import urllib.request
from itertools import combinations, product

from flask import Flask, jsonify, request
from openai import OpenAI
from pinecone import Pinecone
from ortools.linear_solver import pywraplp

app = Flask(__name__)

# --- Lazy external clients ---
@functools.lru_cache()
def get_openai() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing from environment")
    return OpenAI(api_key=api_key)

@functools.lru_cache()
def get_pinecone_index():
    key = os.getenv("PINECONE_API_KEY")
    env = os.getenv("PINECONE_ENV")
    if not key or not env:
        raise RuntimeError("PINECONE_API_KEY / PINECONE_ENV missing from environment")
    pc = Pinecone(api_key=key, environment=env)
    return pc.Index(os.getenv("PINECONE_INDEX_NAME", "dine-nd-menu"))

# --- Cached menu fetch ---
_MENU_CACHE = None
_MENU_CACHE_TIME = 0
_MENU_TTL = 3600  # seconds
MENU_URL = os.getenv("MENU_URL", "https://arda-kurama.github.io/dine-nd/consolidated_menu.json")

def get_menu():
    """Fetch and cache the consolidated menu JSON with TTL."""
    global _MENU_CACHE, _MENU_CACHE_TIME
    now = time.time()
    if _MENU_CACHE is None or now - _MENU_CACHE_TIME > _MENU_TTL:
        with urllib.request.urlopen(MENU_URL) as r:
            _MENU_CACHE = json.load(r)
        _MENU_CACHE_TIME = now
    return _MENU_CACHE

# --- Section definitions ---
BASE_DIR = os.path.dirname(__file__)
JSON_PATH = os.path.join(BASE_DIR, "..", "mobile-app", "src", "components", "section_defs.json")
with open(JSON_PATH) as fp:
    raw_defs = json.load(fp)
SECTION_DEFS = [(d["title"], re.compile(d["pattern"])) for d in raw_defs]

# --- Utilities ---
def parse_num(x):
    if isinstance(x, (int, float)): return int(x)
    if isinstance(x, str):
        m = re.search(r"\d+", x)
        return int(m.group()) if m else 0
    return 0

# --- ILP solver functions ---
def brute_force_plate(menu_items, targets, weights, max_servings=2, max_dishes=4):
    best_score = float('inf')
    best = []
    for r in range(1, max_dishes+1):
        for idxs in combinations(range(len(menu_items)), r):
            for servs in product(range(1, max_servings+1), repeat=r):
                totals = {k:0.0 for k in targets}
                for i, s in zip(idxs, servs):
                    for k in targets:
                        totals[k] += menu_items[i]['macros'].get(k,0)*s
                score = sum(weights.get(k,1)*(totals[k]-targets[k])**2 for k in targets)
                if score < best_score:
                    best_score = score
                    best = [{'name':menu_items[i]['name'], 'servings':s,
                             'servingSize':menu_items[i]['serving_size']} for i,s in zip(idxs, servs)]
    return best


def optimize_plate(menu_items, targets, weights):
    solver = pywraplp.Solver.CreateSolver(os.getenv('MIP_SOLVER','CBC_MIXED_INTEGER_PROGRAMMING'))
    if not solver:
        return brute_force_plate(menu_items, targets, weights)

    x = {}
    for i in range(len(menu_items)):
        for s in (1,2):
            x[(i,s)] = solver.IntVar(0,1,f'x_{i}_{s}')
    total = {k:solver.NumVar(0,solver.infinity(),f'total_{k}') for k in targets}
    error = {k:solver.NumVar(0,solver.infinity(),f'err_{k}') for k in targets}

    for k in targets:
        solver.Add(
            sum(menu_items[i]['macros'].get(k,0)*s*x[(i,s)]
                for i in range(len(menu_items)) for s in (1,2)) == total[k]
        )
        solver.Add(error[k] >= total[k]-targets[k])
        solver.Add(error[k] >= targets[k]-total[k])
    solver.Add(sum(x.values()) <= 4)

    obj = solver.Objective()
    for k,w in weights.items(): obj.SetCoefficient(error[k], w)
    obj.SetMinimization()

    st = solver.Solve()
    if st in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        return [ {'name':menu_items[i]['name'],'servings':s,'servingSize':menu_items[i]['serving_size']}
                 for (i,s),v in x.items() if v.solution_value()>0.5 ]
    return brute_force_plate(menu_items, targets, weights)

def gpt_refine(plate, targets, hall, meal):
    """Refine candidate plates by selecting the most cohesive and tasty one using GPT."""
    # Build a list of candidate options wrapped as JSON strings
    options = json.dumps(plate)
    prompt = (
        f"You are a meal planner. Given these candidate plates: {options}"
        f"Macro targets: {json.dumps(targets)}"
        f"Dining hall: {hall}, Meal: {meal}"
        "Please select the single most cohesive and tasty plate that meets the macro targets, "
        "and return it in JSON format as a list of items with fields name, servings, servingSize, and macros."
    )
    oa = get_openai()
    chat = oa.chat.completions.create(
        model='gpt-4.1-nano',
        messages=[{'role':'user','content':prompt}],
        temperature=0.7
    )
    try:
        return json.loads(chat.choices[0].message.content)
    except Exception:
        # fallback to original plate list
        return plate

# --- Routes ---
@app.route('/', methods=['GET'])
def health():
    return jsonify(status='ok'),200

@app.route('/sections', methods=['GET'])
def get_sections():
    hall = request.args.get('hall')
    meal = request.args.get('meal')
    MENU = get_menu()
    try:
        cats = MENU['dining_halls'][hall][meal]['categories'].keys()
    except KeyError:
        return jsonify(error='unknown hall or meal'),400
    secs = [title for title,rx in SECTION_DEFS if any(rx.search(cat) for cat in cats)]
    return jsonify(sections=secs),200

@app.route('/plan-plate', methods=['POST'])
def plan_plate():
    data = request.get_json(force=True)
    hall = data.get('hall')
    meal = data.get('meal')
    targets = {
        'calories': data.get('calorieTarget') or 0,
        'protein':  data.get('proteinTarget') or 0,
        'carbs':    data.get('carbTarget') or 0,
        'fat':      data.get('fatTarget') or 0,
    }
    avoid = [a.lower() for a in data.get('avoidAllergies',[])]
    sections = data.get('sections', [])

    start = time.time()
    MENU = get_menu()

    # Vector query
    oa = get_openai()
    qtext = f"{meal} at {hall}, " + ", ".join(
        f"{targets[k]}{'kcal' if k=='calories' else 'g'} {k}" for k in targets if targets[k]
    )
    uvec = oa.embeddings.create(model='text-embedding-3-small', input=qtext).data[0].embedding

    idx = get_pinecone_index()
    f = {'hall':hall,'meal':meal}
    if sections: f['section'] = {'$in':sections}
    if avoid:    f['allergens'] = {'$nin':avoid}
    resp = idx.query(vector=uvec, top_k=25, filter=f, include_metadata=True)

    candidates = []
    for m in resp.matches[:20]:
        meta = m.metadata if hasattr(m, 'metadata') else m.get('metadata',{})
        candidates.append({
            'name': m.id.split('|')[-1].strip(),
            'serving_size': meta.get('serving_size',''),
            'macros':{
                'calories': parse_num(meta.get('calories',0)),
                'protein':  parse_num(meta.get('protein',0)),
                'carbs':    parse_num(meta.get('total_carbohydrate',0)),
                'fat':      parse_num(meta.get('total_fat',0)),
            }
        })

    # --- solve & refine ---
    plate = optimize_plate(candidates, targets, weights={'calories':1,'protein':1,'carbs':1,'fat':1})
    choice = gpt_refine(plate, targets, hall, meal)

    # Compute totals in the old format
    totals = {k: 0 for k in targets}
    for item in choice:
        # find original macros for this item
        for c in candidates:
            if c['name'] == item.get('name') and c['serving_size'] == item.get('servingSize'):
                for k in totals:
                    totals[k] += c['macros'].get(k, 0) * item.get('servings', 1)
                break

    # Return exactly the old schema: { items: [...], totals: {...} }
    return jsonify({
        'items': choice,
        'totals': totals
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT',5000)), debug=True)
