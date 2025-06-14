import json
import os
import sys
from typing import Dict, List

from openai import OpenAI
from pinecone import Pinecone

# Config
INDEX_NAME: str = "dine-nd-menu"
BATCH_SIZE: int = 100  # Pinecone upsert request size limit safety margin

def load_menu(path: str) -> Dict:
    """Load and return the consolidated menu JSON from *path*."""
    with open(path, "r", encoding="utf-8") as fp:
        return json.load(fp)

def build_vectors(menu: Dict, client: OpenAI) -> List[Dict]:
    """Convert *menu* into a list of Pinecone vector dictionaries."""

    batch: List[Dict] = []
    for hall, hall_data in menu.get("dining_halls", {}).items():
        for meal_name, meal_data in hall_data.items():
            if not meal_data.get("available", False):
                continue  # Skip unavailable meals

            for category, dishes in meal_data.get("categories", {}).items():
                if not isinstance(dishes, list):
                    continue

                for dish in dishes:
                    if not isinstance(dish, dict):
                        continue

                    name: str = dish.get("name", "Unnamed Dish")
                    nutrition: Dict = dish.get("nutrition", {})

                    # Build the input text for embedding generation
                    text: str = f"{name}: {nutrition}"
                    embedding_resp = client.embeddings.create(
                        model="text-embedding-3-small",
                        input=text,
                    )
                    embedding = embedding_resp.data[0].embedding

                    doc_id: str = f"{hall}|{meal_name}|{category}|{name}"
                    batch.append(
                        {
                            "id": doc_id,
                            "values": embedding,
                            "metadata": {
                                "hall": hall,
                                "meal": meal_name,
                                "category": category,
                                **nutrition,
                            },
                        }
                    )
    return batch

def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python embed_menu.py <path-to-consolidated_menu.json>")

    menu_path: str = sys.argv[1]
    menu: Dict = load_menu(menu_path)

    # Initialise clients
    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    pinecone_client = Pinecone(
        api_key=os.environ["PINECONE_API_KEY"],
        environment=os.environ["PINECONE_ENV"],
    )
    index = pinecone_client.Index(INDEX_NAME)

    # 1) CLEAR EXISTING DATA
    print(f"Clearing all existing vectors from index '{INDEX_NAME}'…")
    index.delete(delete_all=True)  # Completely wipes the index
    print("Index cleared. Inserting fresh data…")

    # 2) BUILD NEW VECTORS
    vectors: List[Dict] = build_vectors(menu, openai_client)
    print(f"Prepared {len(vectors)} vectors for upsert.")

    # 3) UPSERT IN BATCHES
    for start in range(0, len(vectors), BATCH_SIZE):
        chunk = vectors[start : start + BATCH_SIZE]
        index.upsert(vectors=chunk)
        print(
            f"Upserted {start + len(chunk):>5} / {len(vectors)} vectors"
        )

    print("✅ Pinecone index refresh complete.")

if __name__ == "__main__":
    main()
