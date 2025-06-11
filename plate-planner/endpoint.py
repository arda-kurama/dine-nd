import os
import json
from flask import Flask, request
from pinecone import Pinecone
from openai import OpenAI

app = Flask(__name__)

# Initialize OpenAI and Pinecone clients
env_openai = os.getenv("OPENAI_API_KEY")
env_pinecone_key = os.getenv("PINECONE_API_KEY")
env_pinecone_env = os.getenv("PINECONE_ENV")

openai = OpenAI(api_key=env_openai)
pc = Pinecone(api_key=env_pinecone_key, environment=env_pinecone_env)
index = pc.Index("dine-nd-menu")

# Health endpoint for Zappa deploy validation
@app.route("/", methods=["GET"])
def health():
    return {"status": "ok", "message": "Plate Planner API is running!"}, 200

# Main endpoint / plan-plate
@app.route("/plan-plate", methods=["POST"])
def plan_plate():
    data = request.get_json(force=True)
    hall = data.get("hall")
    meal = data.get("meal")

    # User specified nutrition targets
    calorie_target = data.get("calorieTarget")
    protein_target = data.get("proteinTarget")
    carb_target = data.get("carbTarget")
    fat_target = data.get("fatTarget")

    # 1. Embed the user query
    query_text = f"{meal} at {hall}"
    if protein_target:
        query_text += f", {protein_target}g protein"
    if carb_target:
        query_text += f", {carb_target}g carbs"
    if fat_target:
        query_text += f", {fat_target}g fat"
    if calorie_target:
        query_text += f", ~{calorie_target} kcal"

    emb_resp = openai.embeddings.create(
        model="text-embedding-3-small",
        input=query_text
    )
    user_emb = emb_resp.data[0].embedding

    # 2. Retrieve top-K candidate dishes from Pinecone
    query_resp = index.query(
        vector=user_emb,
        top_k=15,
        filter={"hall": hall, "meal": meal}
    )
    candidates = query_resp.get("matches", [])

    # 3. Convert matches into JSON-serializable dicts
    serializable = []
    for match in candidates:
        if hasattr(match, 'id'):
            entry = {
                "id": match.id,
                "score": match.score,
                # some clients use 'values', others 'vector'
                "values": getattr(match, 'values', getattr(match, 'vector', None)),
                # include metadata if present
                **(match.metadata or {})
            }
        else:
            # assume it's already a dict
            entry = match
        serializable.append(entry)

    # 4. Build LLM prompt with strict schema instructions
    schema = {
        "items": [{"name": "...", "servings": 1}],
        "totals": {key: 0 for key in ["calories", "protein", "carbs", "fat"]}
    }

    prompt = f"""
    You are a meal-planning assistant. Given these items:
    {json.dumps(serializable, indent=2)}

    Targets:
    """
    if calorie_target:
        prompt += f"- Calories: {calorie_target}\n"
    if protein_target:
        prompt += f"- Protein: {protein_target}g\n"
    if carb_target:
        prompt += f"- Carbohydrates: {carb_target}g\n"
    if fat_target:
        prompt += f"- Fat: {fat_target}g\n"
    prompt += f"\nProvide *only* JSON in this exact schema format (no extra keys, no prose):\n{json.dumps(schema, indent=2)}"

    # 5. Call the LLM for meal planning
    chat = openai.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[
            {"role": "system", "content": "You are a nutrition-planning assistant."},
            {"role": "user", "content": prompt}
        ]
    )
    result = chat.choices[0].message.content.strip()

    # Return the raw JSON response
    return app.response_class(response=result, status=200, mimetype="application/json")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
