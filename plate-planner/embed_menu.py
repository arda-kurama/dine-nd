import os, json
from pinecone import Pinecone
from openai import OpenAI
import sys

# Initialize clients
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"),
              environment=os.getenv("PINECONE_ENV"))
index = pc.Index("dine-nd-menu")

# Load menu
path = sys.argv[1]
with open(path) as f:
    menu = json.load(f)

# Build a batch of embeddings with metadata
batch = []
for hall, hall_data in menu.get("dining_halls", {}).items():
    for meal_name, meal_data in hall_data.items():
        if not meal_data.get("available", False):
            continue
        categories = meal_data.get("categories", {})
        for category, dishes in categories.items():
            if not isinstance(dishes, list):
                continue
            for dish in dishes:
                if not isinstance(dish, dict):
                    continue
                name = dish.get("name", "Unnamed Dish")
                nutrition = dish.get("nutrition", {})
                text = f"{name}: {nutrition}"
                resp = openai.embeddings.create(
                    model="text-embedding-3-small",
                    input=text
                )
                embedding = resp.data[0].embedding
                doc_id = f"{hall}|{meal_name}|{category}|{name}"
                batch.append({
                    "id": doc_id,
                    "values": embedding,
                    "metadata": {"hall": hall, "meal": meal_name, "category": category, **nutrition}
                })

# Upsert in chunks to avoid request size limits
chunk_size = 100
for i in range(0, len(batch), chunk_size):
    chunk = batch[i:i + chunk_size]
    index.upsert(vectors=chunk)
    print(f"Upserted chunk {i // chunk_size + 1} ({len(chunk)} items)")

print(f"Total upserted items: {len(batch)}")