import os, json
from pinecone import Pinecone
from openai import OpenAI
import sys

# 1. Init clients
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"),
              environment=os.getenv("PINECONE_ENV"))
index = pc.Index("dine-nd-menu")

# 2. Load menu
path = sys.argv[1]
with open(path) as f:
    menu = json.load(f)

# 3. Build embeddings batch
batch = []
for hall, meals in menu["dining_halls"].items():
    for meal_name, categories in meals.items():
        for category, dishes in categories.items():
            for dish in dishes:
                # now `dish` is a dict with 'name', 'nutrition', 'id', etc.
                text = f"{dish['name']}: {dish['nutrition']}"
                emb = openai.embeddings.create(
                         model="text-embedding-3-small",
                         input=text
                      )["data"][0]["embedding"]
                batch.append({
                  "id": f"{hall}|{meal_name}|{dish['id']}",
                  "values": emb,
                  "metadata": {
                    "hall": hall,
                    "meal": meal_name,
                    "category": category,
                    **dish["nutrition"]
                  }
                })

# 4. Upsert
index.upsert(vectors=batch)
print(f"Upserted {len(batch)} items.")
