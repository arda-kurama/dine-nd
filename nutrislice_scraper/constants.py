"""
Constants and data types used across the scraping pipeline.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from collections import namedtuple

HALLS = [
    "Holy Cross College Dining Hall",
    "North Dining Hall",
    "Saint Mary's Dining Hall",
    "South Dining Hall",
]

# Robust date strings (Linux + Windows)
_now = datetime.now(ZoneInfo("America/New_York"))
DATE_STR = _now.strftime("%A, %B %d, %Y").replace(" 0", " ")
DATE_ISO = _now.strftime("%Y-%m-%d")

MAX_RETRIES = 2

# Nutrislice API host (confirmed by your run)
NUTRISLICE_BASE = "https://nd.api.nutrislice.com"

# Only halls that exist on Nutrislice right now
NUTRISLICE_SCHOOLS = {
    "North Dining Hall": "north-dining-hall",
    "South Dining Hall": "south-dining-hall",
}

# Candidate menu types to probe (discovery will filter)
NUTRISLICE_MENU_TYPES = [
    "breakfast",
    "lunch",
    "late-lunch",
    "dinner",
    "brunch",
    "special",
]

# Display name mapping (keep your old meal names)
MENU_TYPE_DISPLAY = {
    "breakfast": "Breakfast",
    "lunch": "Lunch",
    "late-lunch": "Late Lunch",
    "dinner": "Dinner",
    "brunch": "Brunch",
    "special": "Special",
}

FoodItem = namedtuple('FoodItem', ['name', 'serving_size', 'nutrition', 'daily_values', 'ingredients', 'allergens'])
MealData = namedtuple('MealData', ['hall', 'meal', 'available', 'categories'])
