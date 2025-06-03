from datetime import datetime
from collections import namedtuple

HALLS = [
    "Holy Cross College Dining Hall",
    "North Dining Hall",
    "Saint Mary's Dining Hall",
    "South Dining Hall",
]

WAIT_TIMEOUT_SECS = 5
DATE_STR = datetime.now().strftime("%A, %B %-d, %Y")
URL = "https://netnutrition.cbord.com/nn-prod/ND"

# Data structures for in memory processing
FoodItem = namedtuple('FoodItem', ['name', 'serving_size', 'nutrition', 'daily_values', 'ingredients', 'allergens'])
MealData = namedtuple('MealData', ['hall', 'meal', 'available', 'categories'])
