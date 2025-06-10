import os, json
import pinecone
from flask import Flask, request, jsonify
from openai import OpenAI

app = Flask(__name__)
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
pinecone.init(api_key=os.getenv("PINECONE_API_KEY"),
              environment=os.getenv("PINECONE_ENV"))
index = pinecone.Index("dine_nd_menu")

@app.route("/plan-plate", methods=["POST"])
def plan_plate():
    data = request.json
    hall, meal, protein = data["hall"], data["meal"], data["proteinTarget"]

    # 1. Embed user query
    user_emb = openai.embeddings.create(
        model="text-embedding-3-small",
        input=f"{meal} at {hall}, {protein}g protein"
    )["data"][0]["embedding"]

    # 2. Retrieve top-K
    resp = index.query(vector=user_emb, top_k=15,
                       filter={"hall": hall, "meal": meal})
    candidates = resp["matches"]

    # 3. Build prompt
    prompt = f"""
Available items at {hall} ({meal}):
{json.dumps(candidates, indent=2)}

Pick servings to provide ≥{protein}g protein, ~700 kcal, ≥1 veg.
Return items, sizes, and total macros.
""".strip()

    # 4. Call GPT
    chat = openai.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[
          {"role":"system","content":"You’re a nutrition-planning assistant."},
          {"role":"user","content":prompt}
        ]
    )
    return jsonify(plan=chat.choices[0].message.content)

if __name__ == "__main__":
    app.run()
