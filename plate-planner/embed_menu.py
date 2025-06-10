import os, json
import pinecone
from openai import OpenAI

# 1. Init clients
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
pinecone.init(api_key=os.getenv("PINECONE_API_KEY"),
              environment=os.getenv("PINECONE_ENV"))
index = pinecone.Index("dine_nd_menu")

# 2. Load menu
with open("consolidated_menu.json") as f:
    menu = json.load(f)

# 3. Build embeddings batch
batch = []
for hall, meals in menu["dining_halls"].items():
    for meal, items in meals.items():
        for dish in items:
            text = f"{dish['name']}: {dish['nutrition']}"
            emb = openai.embeddings.create(
                    model="text-embedding-3-small",
                    input=text
                  )["data"][0]["embedding"]
            batch.append({
              "id": f"{hall}|{meal}|{dish['id']}",
              "values": emb,
              "metadata": {"hall": hall, "meal": meal, **dish["nutrition"]}
            })

# 4. Upsert
index.upsert(vectors=batch)
print(f"Upserted {len(batch)} items.")
