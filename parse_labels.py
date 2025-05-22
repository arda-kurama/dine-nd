import os
import json
import re
from bs4 import BeautifulSoup
from concurrent.futures import ProcessPoolExecutor, as_completed

# ROOT directory where master_scraper wrote HTML labels
BASE_DIR = "all_nutrition_data"

# Regex to detect tokens with digits (e.g. "4g", "150", "40%")
NUM_RE = re.compile(r"\d")

# Utility to sort filenames by the numeric index in 'label_<n>.html'
def sort_key(filename):
    match = re.search(r"label_(\d+)\.html", filename)
    return int(match.group(1)) if match else -1

# Parse a single group folder into cleaned JSON
# Returns (hall_meal, group, count)
def parse_group(group_dir):
    """
    Parse all label_*.html files in a single group directory,
    clean up key/value pairs, and dump a <group>.json
    """
    group = os.path.basename(group_dir)
    hall_meal = os.path.basename(os.path.dirname(group_dir))
    results = []

    # Iterate each HTML label in numeric order
    for filename in sorted(os.listdir(group_dir), key=sort_key):
        if not (filename.startswith("label_") and filename.endswith(".html")):
            continue
        filepath = os.path.join(group_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")

        # Item name
        name_tag = soup.find("td", class_="cbo_nn_LabelHeader")
        name = name_tag.get_text(strip=True) if name_tag else "Unknown"

        # Serving size (skip in nutrients)
        serve_tag = soup.find("td", class_="cbo_nn_LabelBottomBorderLabel")
        serving_size = (
            serve_tag.get_text(strip=True)
            .replace("Serving Size:", "")
            .strip()
        ) if serve_tag else "Unknown"

        # Build nutrient dict by pairing adjacent TDs
        nutrients = {}
        table = soup.find("table", class_="cbo_nn_NutritionLabelTable")
        if table:
            for tr in table.find_all("tr"):
                cells = tr.find_all("td")
                for i in range(0, len(cells) - 1, 2):
                    label = cells[i].get_text(strip=True).rstrip(":")
                    value = cells[i+1].get_text(strip=True)
                    # skip blank values or no digits
                    if not value or not NUM_RE.search(value):
                        continue
                    # skip unwanted labels
                    low = label.lower()
                    if low.startswith("serving size") or low.startswith("percent"):
                        continue
                    if low == name.lower():
                        continue
                    nutrients[label] = value

        # Extract Ingredients and Contains sections
        text = soup.get_text("")
        ing_lines = [ln.partition(":")[2].strip() for ln in text.splitlines() if ln.strip().startswith("Ingredients:")]
        if ing_lines:
            nutrients["Ingredients"] = " ".join(ing_lines)
        contain_lines = [ln.partition(":")[2].strip() for ln in text.splitlines() if ln.strip().startswith("Contains:")]
        if contain_lines:
            nutrients["Contains"] = " ".join(contain_lines)

        results.append({
            "file": filename,
            "name": name,
            "serving_size": serving_size,
            "nutrients": nutrients,
        })

    # Write out JSON
    out_file = os.path.join(group_dir, f"{group}.json")
    with open(out_file, "w", encoding="utf-8") as out:
        json.dump(results, out, indent=2)
    return (hall_meal, group, len(results))

# Parse all groups under one meal directory
# Returns (hall_meal, list_of_results)
def parse_meal(hall_meal_dir):
    hall_meal = os.path.basename(hall_meal_dir)
    res = []
    for group in os.listdir(hall_meal_dir):
        group_dir = os.path.join(hall_meal_dir, group)
        if not os.path.isdir(group_dir):
            continue
        outcome = parse_group(group_dir)
        res.append(outcome)
        print(f"Parsed {outcome[2]} labels for {outcome[0]}/{outcome[1]}")
    return (hall_meal, res)

if __name__ == '__main__':
    # Collect all meal dirs
    meal_dirs = [os.path.join(BASE_DIR, d) for d in os.listdir(BASE_DIR)
                 if os.path.isdir(os.path.join(BASE_DIR, d))]

    # Parallel parse by meal
    max_workers = os.cpu_count() or 2
    from concurrent.futures import ProcessPoolExecutor, as_completed
    with ProcessPoolExecutor(max_workers=max_workers) as exe:
        futures = {exe.submit(parse_meal, md): md for md in meal_dirs}
        for fut in as_completed(futures):
            try:
                meal, details = fut.result()
            except Exception as e:
                print(f"Error parsing {futures[fut]}: {e}")
