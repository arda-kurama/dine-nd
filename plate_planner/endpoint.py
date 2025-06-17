from functools import lru_cache
import json
import os

from flask import Flask, jsonify, request
from openai import OpenAI
from pinecone import Pinecone

app = Flask(__name__)

# Lazy helpers – created only on first real request
@lru_cache
def get_openai() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing from environment")
    return OpenAI(api_key=api_key)
@lru_cache
def get_pinecone_index():
    key = os.getenv("PINECONE_API_KEY")
    env = os.getenv("PINECONE_ENV")
    if not key or not env:
        raise RuntimeError("PINECONE_API_KEY / PINECONE_ENV missing from environment")
    pc = Pinecone(api_key=key, environment=env)
    return pc.Index("dine-nd-menu")

# Routes
@app.route("/", methods=["GET"])
def health():
    """Lightweight health check used by Zappa's deploy validation."""
    return jsonify(status="ok"), 200

@app.route("/plan-plate", methods=["POST"])
def plan_plate():
    """Generate a meal plan hitting macro targets using Pinecone + GPT-4."""
    data = request.get_json(force=True)
    hall: str | None = data.get("hall")
    meal: str | None = data.get("meal")

    # Macros (may be None)
    cal = data.get("calorieTarget")
    protein = data.get("proteinTarget")
    carbs = data.get("carbTarget")
    fat = data.get("fatTarget")

    # Allergies to avoid (list of strings)
    avoid: list[str] = data.get("avoidAllergies", [])

    # 1) Embed query
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

    openai = get_openai()
    emb = openai.embeddings.create(model="text-embedding-3-small", input=query_text)
    user_vec = emb.data[0].embedding

    # 2) Retrieve menu items from Pinecone
    index = get_pinecone_index()
    resp = index.query(vector=user_vec, top_k=15, filter={"hall": hall, "meal": meal})

    # Make matches JSON‑serialisable
    matches: list[dict] = []
    for m in resp.get("matches", []):
        meta = getattr(m, "metadata", {}) or {}
        item_allergens = meta.get("allergens", [])  # now a list[str]
        # Skip any item that has at least one avoided allergen
        if any(a in item_allergens for a in avoid):
            continue
        matches.append({
            "id": getattr(m, "id", None),
            "score": getattr(m, "score", None),
            "values": getattr(m, "values", getattr(m, "vector", None)),
            **meta,
        })

    # 3) Prompt GPT for plate suggestion (strict JSON)
    schema = {
        "items": [{"name": "...", "servings": 1}],
        "totals": {k: 0 for k in ("calories", "protein", "carbs", "fat")},
    }
    prompt_lines = [
        "You are a meal-planning assistant. Given these items:",
        # Defense-in-depth: remind GPT to avoid these
        f"Do NOT include any items that contain these allergens: {', '.join(avoid)}.",
        "\nGiven these items:",
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
    prompt_lines.append(
        "\nProvide *only* JSON in this exact schema (no prose):\n" +
        json.dumps(schema, indent=2)
    )

    chat = openai.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[
            {"role": "system", "content": "You are a nutrition-planning assistant."},
            {"role": "user", "content": "\n".join(prompt_lines)},
        ],
    )
    result_json = chat.choices[0].message.content.strip()

    return app.response_class(result_json, status=200, mimetype="application/json")

if __name__ == "__main__":
    # Local dev: python endpoint.py
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
