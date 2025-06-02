from datetime import datetime
from collections import namedtuple

HALLS = [
    "Holy Cross College Dining Hall",
    "North Dining Hall",
    "Saint Mary's Dining Hall",
    "South Dining Hall",
]

PREFIX = {
    "North Dining Hall":      "NDH",
    "South Dining Hall":      "SDH",
    "Saint Mary's Dining Hall": "SMC",
    "Holy Cross College Dining Hall": "HCC",
}

HALL_MAPPING = {v: k for k, v in PREFIX.items()}

DATE_STR = datetime.now().strftime("%A, %B %-d, %Y")
URL = "https://netnutrition.cbord.com/nn-prod/ND"

# Data structures for in-memory processing
FoodItem = namedtuple('FoodItem', ['name', 'serving_size', 'nutrition', 'daily_values', 'ingredients', 'allergens'])
MealData = namedtuple('MealData', ['hall', 'meal', 'available', 'categories'])
