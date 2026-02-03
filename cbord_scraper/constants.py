"""
Constants and data types used across the scraping pipeline.

Includes:
- Dining hall names and target URL
- Timeouts and retry limits
- Namedtuples for food item and meal data
"""

from datetime import datetime
from collections import namedtuple

HALLS = [
    "Holy Cross College Dining Hall",
    "North Dining Hall",
    "Saint Mary's Dining Hall",
    "South Dining Hall",
]

WAIT_TIMEOUT_SECS = 10
PAGE_LOAD_TIMEOUT_SECS = 30
MAX_RETRIES = 2
DATE_STR = datetime.now().strftime("%A, %B %-d, %Y")
URL = "https://netnutrition.cbord.com/nn-prod/ND"

# Data structures for in memory processing
FoodItem = namedtuple('FoodItem', ['name', 'serving_size', 'nutrition', 'daily_values', 'ingredients', 'allergens'])
MealData = namedtuple('MealData', ['hall', 'meal', 'available', 'categories'])
