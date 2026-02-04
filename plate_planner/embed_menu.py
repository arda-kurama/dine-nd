"""
Embed menu items for DineND into a Pinecone vector index.

This script:
  1. Loads a consolidated menu JSON file.
  2. Classifies each dish into a section using regex rules.
  3. Generates text embeddings via OpenAI.
  4. Upserts embeddings (and metadata) into a Pinecone index in batches.
"""

import json
import os
import sys
import re
import hashlib
import unicodedata

from typing import Dict, List
from openai import OpenAI
from pinecone import Pinecone
from pinecone.exceptions import NotFoundException

# Config
INDEX_NAME: str = "dine-nd-menu"

# Batch size chosen to stay under Pinecone's limit
BATCH_SIZE: int = 100

# Path to the shared section definitions JSON
BASE_DIR = os.path.dirname(__file__)
JSON_PATH = os.path.join(BASE_DIR, "..", "mobile-app", "src", "components", "section_defs.json")

# Load and compile regex patterns for section classification
with open(JSON_PATH) as fp:
    raw_defs = json.load(fp)
SECTION_DEFS = [(d["title"], re.compile(d["pattern"])) for d in raw_defs]

def classify_section(category: str) -> str:
    """
    Return the section title that matches the given category string.
    Falls back to "Other" if no pattern matches.
    """
    for title, rx in SECTION_DEFS:
        if rx.search(category):
            return title
    return "Other"

def load_menu(path: str) -> Dict:
    """
    Read and parse the consolidated_menu.json at the given path.
    Returns the JSON as a Python dict.
    """
    with open(path, "r", encoding="utf-8") as fp:
        return json.load(fp)

def make_pinecone_id(raw: str) -> str:
    """
    Pinecone requires ASCII-only IDs. We:
    - normalize/strip accents to ASCII
    - keep it readable-ish
    - append a hash so collisions are basically impossible
    """
    norm = unicodedata.normalize("NFKD", raw)
    ascii_part = norm.encode("ascii", "ignore").decode("ascii")
    ascii_part = re.sub(r"[^A-Za-z0-9|._-]+", "_", ascii_part).strip("_")

    h = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]

    if not ascii_part:
        return h
    return f"{ascii_part[:200]}|{h}"

def build_vectors(menu: Dict, client: OpenAI) -> List[Dict]:
    """
    Convert the menu data into a list of Pinecone vector dictionaries.
    Each vector entry contains:
      - `id` (hall|meal|category|dish name)
      - `values` (the embedding)
      - `metadata` (hall, meal, category, nutrition, allergens, section)
    """

    batch: List[Dict] = []

    # Iterate through halls and meals
    for hall, hall_data in menu.get("dining_halls", {}).items():
        for meal_name, meal_data in hall_data.items():
            # Skip meals not currently available
            if not meal_data.get("available", False):
                continue

            # Iterate through each category in this meal
            for category, dishes in meal_data.get("categories", {}).items():
                # Ensure category entry is a list
                if not isinstance(dishes, list):
                    continue

                for dish in dishes:
                    # Each dish should be a dict
                    if not isinstance(dish, dict):
                        continue

                    # Extract dish fields, with defaults
                    name: str = dish.get("name", "Unnamed Dish")
                    nutrition: Dict = dish.get("nutrition", {})
                    raw_allergens = dish.get("allergens", "")

                    # Normalize allergens into a list of strings
                    if isinstance(raw_allergens, str):
                        allergens = [a.strip().lower() for a in raw_allergens.split(",") if a.strip()]
                    else:
                        allergens = []

                    # Classify this category into a section title
                    section = classify_section(category)

                    # Prepare the text for embedding
                    text: str = f"{name}: {nutrition}"
                    embedding_resp = client.embeddings.create(
                        model="text-embedding-3-small",
                        input=text,
                    )
                    embedding = embedding_resp.data[0].embedding

                    # Construct a unique doc ID (Pinecone requires ASCII IDs)
                    raw_id: str = f"{hall}|{meal_name}|{category}|{name}"
                    doc_id: str = make_pinecone_id(raw_id)

                    batch.append(
                        {
                            "id": doc_id,
                            "values": embedding,
                            "metadata": {
                                "hall": hall,
                                "meal": meal_name,
                                "category": category,
                                "raw_id": raw_id,  # keep original for debugging/auditing
                                **nutrition,
                                "allergens": allergens,
                                "section": section,
                                "serving_size": dish.get("serving_size", ""),
                            },
                        }
                    )

    return batch

def main() -> None:
    """
    Entry point:
      - Parses CLI arguments.
      - Initializes OpenAI & Pinecone clients.
      - Clears existing index data.
      - Builds new vectors and upserts them in batches.
    """
    if len(sys.argv) != 2:
        sys.exit("Usage: python embed_menu.py <path-to-consolidated_menu.json>")

    menu_path: str = sys.argv[1]
    menu: Dict = load_menu(menu_path)

    # Initialise API clients
    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    pinecone_client = Pinecone(
        api_key=os.environ["PINECONE_API_KEY"],
        environment=os.environ["PINECONE_ENV"],
    )
    index = pinecone_client.Index(INDEX_NAME)

    # 1) Delete all existing vectors from the index if any exist
    print(f"Clearing all existing vectors from index '{INDEX_NAME}'…")
    try:
        index.delete(delete_all=True)
        print("Index cleared.")
    except NotFoundException:
        print("No existing namespace (nothing to delete).")
    print("Index cleared. Inserting fresh data…")

    # 2) Build the new vectors
    vectors: List[Dict] = build_vectors(menu, openai_client)
    print(f"Prepared {len(vectors)} vectors for upsert.")

    # 3) Upsert new vectors in batches
    for start in range(0, len(vectors), BATCH_SIZE):
        chunk = vectors[start : start + BATCH_SIZE]
        index.upsert(vectors=chunk)
        print(
            f"Upserted {start + len(chunk):>5} / {len(vectors)} vectors"
        )

    print("✅ Pinecone index refresh complete.")

if __name__ == "__main__":
    main()
