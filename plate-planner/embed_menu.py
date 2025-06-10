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
for hall, hall_data in menu.get("dining_halls", {}).items():
    for meal_name, meal_data in hall_data.items():
        # Skip if the meal is not available
        if not meal_data.get("available", False):
            continue
        # Extract nested categories dict
        categories = meal_data.get("categories", {})
        for category, dishes in categories.items():
            if not isinstance(dishes, list):
                continue
            for dish in dishes:
                if not isinstance(dish, dict):
                    continue
                # Prepare embedding text
                name = dish.get("name", "Unnamed Dish")
                nutrition = dish.get("nutrition", {})
                text = f"{name}: {nutrition}"
                # Generate embedding
                resp = openai.embeddings.create(
                    model="text-embedding-3-small",
                    input=text
                )
                embedding = resp["data"][0]["embedding"]
                # Create a unique ID for the dish
                doc_id = f"{hall}|{meal_name}|{category}|{name}"
                # Append to batch
                batch.append({
                    "id": doc_id,
                    "values": embedding,
                    "metadata": {"hall": hall, "meal": meal_name, "category": category, **nutrition}
                })

# 4. Upsert the batch into Pinecone
index.upsert(vectors=batch)
print(f"Upserted {len(batch)} items.")
