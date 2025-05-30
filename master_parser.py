import os
import json
import re
from bs4 import BeautifulSoup
from concurrent.futures import ProcessPoolExecutor, as_completed

# Helper function to sort filenames by the numeric index in 'label_<n>.html'
def sort_key(filename):
    match = re.search(r"label_(\d+)\.html", filename)
    return int(match.group(1)) if match else -1

# Function to extract nutrition data from a single HTML file
def extract_nutrition_data(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    # Extract the name of the food
    name_tag = soup.find("td", class_="cbo_nn_LabelHeader")
    name = name_tag.get_text(strip=True) if name_tag else "Unknown"

    # Extract the serving size information
    serving_tag = soup.find("td", class_="cbo_nn_LabelBottomBorderLabel")
    serving_size = serving_tag.get_text(strip=True).replace("Serving Size:", "").replace('\xa0', ' ').strip()

    # Can hardcode nutrient names instead of parsing since all labels have the same structure
    nutrient_names = ["Calories", "Calories from Fat", "Total Fat", "Saturated Fat", "Cholesterol",
                      "Sodium", "Potassium", "Total Carbohydrate", "Dietary Fiber", "Sugars", "Protein"]

    # Extract nutrients from the nutrition label table
    nutrient_tags = soup.find_all("span", class_="cbo_nn_SecondaryNutrient")
    nutrients = [tag.get_text(strip=True) for tag in nutrient_tags]

    # Extract daily values from the nutrition label
    daily_value_tags = soup.find_all("td", class_="cbo_nn_LabelLeftPaddedDetail")
    
    # Can pad daily values to match nutrient names since all labels have the same structure
    daily_values = ["", ""] + [tag.get_text(strip=True) for tag in daily_value_tags]

    # Extract ingredients
    ingredient_tag = soup.find("span", class_="cbo_nn_LabelIngredients")
    ingredients = ingredient_tag.get_text(strip=True) if ingredient_tag else "Not Specified"

    # Extract allergens
    allergen_tag = soup.find("span", class_="cbo_nn_LabelAllergens")
    allergens = allergen_tag.get_text(strip=True).replace('\xa0', ' ') if allergen_tag else "Not Specified"

    # Create a dictionary to hold all nutrition data
    nutrition = {}
    for i, nutrient_name in enumerate(nutrient_names):
        # Handle cases where there are fewer nutrients than expected
        nutrient_amount = nutrients[i] if i < len(nutrients) else "N/A"
        daily_value = daily_values[i] if i < len(daily_values) else "N/A"

        nutrition[nutrient_name] = {
            "amount": nutrient_amount,
            "daily_value": daily_value,
        }

    # Return a structured dictionary with all extracted data 
    return {
        "File": os.path.basename(filepath),
        "Name": name,
        "Serving Size": serving_size,
        **nutrition,
        "Ingredients": ingredients,
        "Allergens": allergens,
    }

# Function to parse all HTML nutrition lables in a single group directory
def parse_group(group_dir):
    results = []
    # Iterate of each HTML label file in the group directory
    for filename in sorted(os.listdir(group_dir), key=sort_key):
        if filename.startswith("label_") and filename.endswith(".html"):
            filepath = os.path.join(group_dir, filename)
            try:
                results.append(extract_nutrition_data(filepath))
            except Exception as e:
                print(f"Error processing {filepath}: {e}")
                continue

    # Define output JSON file path
    output_path = os.path.join(group_dir, f"{os.path.basename(group_dir)}.json")

    # Write the results to a JSON file
    with open(output_path, "w", encoding="utf-8") as out_file:
        json.dump(results, out_file, indent=2)

    return f"Parsed {len(results)} labels in {group_dir}"

if __name__ == '__main__':
    # ROOT directory where master_scraper wrote HTML labels
    base_dir = "all_nutrition_data"

    # Set up a process pool for concurrent parsing
    tasks = []
    with ProcessPoolExecutor() as executor:

        # Iterate through meal directories
        for meal_dir in os.listdir(base_dir):
            meal_path = os.path.join(base_dir, meal_dir)
            if os.path.isdir(meal_path):

                # Iterate through food categories within each meal
                for group in os.listdir(meal_path):
                    group_path = os.path.join(meal_path, group)
                    if os.path.isdir(group_path):

                        # Schedule parsing task
                        tasks.append(executor.submit(parse_group, group_path))

        # Collect and print results as they complete
        for future in as_completed(tasks):
            print(future.result())
