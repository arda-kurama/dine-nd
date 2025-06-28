"""
Core constants and data types used throughout the DineND scraping pipeline.

Defines:
- HALLS: List of all target dining-hall names.
- WAIT_TIMEOUT_SECS: Selenium driver wait timeout.
- DATE_STR: Human-readable current date string.
- URL: Base endpoint for the NetNutrition menu.
- FoodItem, MealData: Namedtuple types for in-memory data handling.
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
DATE_STR = datetime.now().strftime("%A, %B %-d, %Y")
URL = "https://netnutrition.cbord.com/nn-prod/ND"
MAX_RETRIES = 2

# Data structures for in memory processing
FoodItem = namedtuple('FoodItem', ['name', 'serving_size', 'nutrition', 'daily_values', 'ingredients', 'allergens'])
MealData = namedtuple('MealData', ['hall', 'meal', 'available', 'categories'])
