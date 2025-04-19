import os
import json
from bs4 import BeautifulSoup
import re

def sort_key(filename):
    match = re.search(r'(\d+)', filename)
    return int(match.group(1)) if match else -1

# Set the directory containing the label_*.html files
LABEL_DIR = "ndh_nutrition_labels"  # <-- change this if needed

# Prepare a list to hold all parsed nutrition data
results = []

# Loop through all label files in the directory
for filename in sorted(os.listdir(LABEL_DIR), key=sort_key):
    if filename.startswith("label_") and filename.endswith(".html"):
        filepath = os.path.join(LABEL_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as file:
            soup = BeautifulSoup(file, "html.parser")

            # Extract item name (first large label header)
            name_tag = soup.find("td", class_="cbo_nn_LabelHeader")
            name = name_tag.text.strip() if name_tag else "Unknown"

            # Extract serving size (usually in bottom label section)
            serving_tag = soup.find("td", class_="cbo_nn_LabelBottomBorderLabel")
            serving_size = serving_tag.text.replace("Serving Size:", "").strip() if serving_tag else "Unknown"

            # Extract nutrients
            nutrient_data = {}
            for row in soup.select("table.cbo_nn_NutritionLabelTable tr"):
                cells = row.find_all("td")
                if len(cells) >= 2:
                    label = cells[0].get_text(strip=True)
                    value = cells[1].get_text(strip=True)
                    if label and value:
                        nutrient_data[label] = value

            results.append({
                "name": name,
                "serving_size": serving_size,
                "nutrients": nutrient_data,
                "source_file": filename
            })

# Write the parsed data to a JSON file
# output_path = os.path.join(LABEL_DIR, "nutrition_parsed.json")
with open("ndh_nutrition_data.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

# print(f"✅ Parsed {len(results)} labels and saved to {output_path}")
