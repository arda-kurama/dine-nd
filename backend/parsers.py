"""
HTML parsing utilities to extract structured nutrition data from NetNutrition labels.

Includes:
- extract_numeric_value: Pulls numeric values from strings.
- parse_nutrition_html: Parses food item HTML into a standardized dictionary format.
"""

import re
from typing import Dict, Any
from bs4 import BeautifulSoup

def extract_numeric_value(value_str: Any) -> int:
    """
    From a string like "123 kcal" or "45mg", return the integer portion.
    If no digits are found, return 0.
    """
    
    if isinstance(value_str, str):
        match = re.search(r'(\d+)', value_str)
        return int(match.group(1)) if match else 0
    return 0

def parse_nutrition_html(html_content: str) -> Dict[str, Any]:
    """
    Given the HTML of a nutrition label, return a dict with:
      {
        "name": <food name>,
        "serving_size": <text>,
        "nutrition": {
          "calories": int,
          "calories_from_fat": int,
          "total_fat": str,
          "saturated_fat": str,
          "cholesterol": str,
          "sodium": str,
          "potassium": str,
          "total_carbohydrate": str,
          "dietary_fiber": str,
          "sugars": str,
          "protein": str
        },
        "daily_values": {
          "total_fat": str,
          "saturated_fat": str,
          "cholesterol": str,
          "sodium": str,
          "total_carbohydrate": str,
          "protein": str
        },
        "ingredients": <text or "Not Specified">,
        "allergens": <text or "Not Specified">
      }
    """

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
    # Can hardcode positions since the structure is consistent
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
            "calories": extract_numeric_value(nutrition_dict["Calories"]["amount"]),
            "calories_from_fat": extract_numeric_value(nutrition_dict["Calories from Fat"]["amount"]),
            "total_fat": nutrition_dict["Total Fat"]["amount"],
            "saturated_fat": nutrition_dict["Saturated Fat"]["amount"],
            "cholesterol": nutrition_dict["Cholesterol"]["amount"],
            "sodium": nutrition_dict["Sodium"]["amount"],
            "potassium": nutrition_dict["Potassium"]["amount"],
            "total_carbohydrate": nutrition_dict["Total Carbohydrate"]["amount"],
            "dietary_fiber": nutrition_dict["Dietary Fiber"]["amount"],
            "sugars": nutrition_dict["Sugars"]["amount"],
            "protein": nutrition_dict["Protein"]["amount"]
        },
        "daily_values": {
            "total_fat": nutrition_dict["Total Fat"]["daily_value"],
            "saturated_fat": nutrition_dict["Saturated Fat"]["daily_value"],
            "cholesterol": nutrition_dict["Cholesterol"]["daily_value"],
            "sodium": nutrition_dict["Sodium"]["daily_value"],
            "total_carbohydrate": nutrition_dict["Total Carbohydrate"]["daily_value"],
            "protein": nutrition_dict["Protein"]["daily_value"]
        },
        "ingredients": ingredients,
        "allergens": allergens
    }