import re
from bs4 import BeautifulSoup

def extract_numeric_value(value_str):
    """Extract numeric calories value for easier sorting/filtering"""
    if isinstance(value_str, str):
        match = re.search(r'(\d+)', value_str)
        return int(match.group(1)) if match else 0
    return 0

def parse_nutrition_html(html_content):
    """Parse nutrition label HTML and return structured data"""
    soup = BeautifulSoup(html_content, "html.parser")

    # Extract the name of the food
    name_tag = soup.find("td", class_="cbo_nn_LabelHeader")
    name = name_tag.get_text(strip=True) if name_tag else "Unknown"

    # Extract the serving size information
    serving_tag = soup.find("td", class_="cbo_nn_LabelBottomBorderLabel")
    serving_size = serving_tag.get_text(strip=True).replace("Serving Size:", "").replace('\xa0', ' ').strip()

    # Hardcoded nutrient names since all labels have the same structure
    nutrient_names = ["Calories", "Calories from Fat", "Total Fat", "Saturated Fat", "Cholesterol",
                      "Sodium", "Potassium", "Total Carbohydrate", "Dietary Fiber", "Sugars", "Protein"]

    # Extract nutrients from the nutrition label table
    nutrient_tags = soup.find_all("span", class_="cbo_nn_SecondaryNutrient")
    nutrients = [tag.get_text(strip=True) for tag in nutrient_tags]

    # Extract daily values from the nutrition label
    daily_value_tags = soup.find_all("td", class_="cbo_nn_LabelLeftPaddedDetail")
    daily_values = ["", ""] + [tag.get_text(strip=True) for tag in daily_value_tags]

    # Extract ingredients
    ingredient_tag = soup.find("span", class_="cbo_nn_LabelIngredients")
    ingredients = ingredient_tag.get_text(strip=True) if ingredient_tag else "Not Specified"

    # Extract allergens
    allergen_tag = soup.find("span", class_="cbo_nn_LabelAllergens")
    allergens = allergen_tag.get_text(strip=True).replace('\xa0', ' ') if allergen_tag else "Not Specified"

    # Build nutrition dictionary
    nutrition_dict = {}
    for i, nutrient_name in enumerate(nutrient_names):
        nutrient_amount = nutrients[i] if i < len(nutrients) else "N/A"
        daily_value = daily_values[i] if i < len(daily_values) else "N/A"
        nutrition_dict[nutrient_name] = {
            "amount": nutrient_amount,
            "daily_value": daily_value,
        }

    # Return structured data in final format
    return {
        "name": name,
        "serving_size": serving_size,
        "nutrition": {
            "calories": extract_numeric_value(nutrition_dict.get("Calories", {}).get("amount", "0")),
            "total_fat": nutrition_dict.get("Total Fat", {}).get("amount", "N/A"),
            "saturated_fat": nutrition_dict.get("Saturated Fat", {}).get("amount", "N/A"),
            "cholesterol": nutrition_dict.get("Cholesterol", {}).get("amount", "N/A"),
            "sodium": nutrition_dict.get("Sodium", {}).get("amount", "N/A"),
            "total_carbs": nutrition_dict.get("Total Carbohydrate", {}).get("amount", "N/A"),
            "dietary_fiber": nutrition_dict.get("Dietary Fiber", {}).get("amount", "N/A"),
            "sugars": nutrition_dict.get("Sugars", {}).get("amount", "N/A"),
            "protein": nutrition_dict.get("Protein", {}).get("amount", "N/A")
        },
        "daily_values": {
            "total_fat": nutrition_dict.get("Total Fat", {}).get("daily_value", "N/A"),
            "saturated_fat": nutrition_dict.get("Saturated Fat", {}).get("daily_value", "N/A"),
            "cholesterol": nutrition_dict.get("Cholesterol", {}).get("daily_value", "N/A"),
            "sodium": nutrition_dict.get("Sodium", {}).get("daily_value", "N/A"),
            "total_carbs": nutrition_dict.get("Total Carbohydrate", {}).get("daily_value", "N/A"),
            "dietary_fiber": nutrition_dict.get("Dietary Fiber", {}).get("daily_value", "N/A")
        },
        "ingredients": ingredients,
        "allergens": allergens
    }