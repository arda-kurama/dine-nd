from datetime import datetime
import time
import random

from .constants import (
    DATE_ISO,
    MAX_RETRIES,
    MealData,
    NUTRISLICE_SCHOOLS,
    NUTRISLICE_MENU_TYPES,
)
from .nutrislice_client import NutrisliceRef, fetch_week, extract_day
from .parsers import parse_nutrislice_day_to_categories


DISPLAY_TO_SLUG = {  # inverse of MENU_TYPE_DISPLAY
    "Breakfast": "breakfast",
    "Lunch": "lunch",
    "Late Lunch": "late-lunch",
    "Dinner": "dinner",
    "Brunch": "brunch",
    "Special": "special",
}


def scrape_meal_with_retries(hall: str, meal: str) -> MealData:
    last = MealData(hall=hall, meal=meal, available=False, categories={})
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            last = scrape_meal(hall, meal)
            return last
        except Exception:
            time.sleep(attempt * random.uniform(0.5, 1.5))
    return last


def scrape_meal(hall: str, meal: str) -> MealData:
    school_slug = NUTRISLICE_SCHOOLS.get(hall)
    menu_type_slug = DISPLAY_TO_SLUG.get(meal)

    if not school_slug or not menu_type_slug:
        return MealData(hall=hall, meal=meal, available=False, categories={})

    y, m, d = map(int, DATE_ISO.split("-"))
    day_obj = datetime(y, m, d).date()

    ref = NutrisliceRef(school_slug=school_slug, menu_type_slug=menu_type_slug, day=day_obj)
    week_json = fetch_week(ref)
    if not week_json:
        return MealData(hall=hall, meal=meal, available=False, categories={})

    day_json = extract_day(week_json, DATE_ISO)
    if not day_json:
        return MealData(hall=hall, meal=meal, available=False, categories={})

    categories = parse_nutrislice_day_to_categories(day_json)
    if not categories:
        return MealData(hall=hall, meal=meal, available=False, categories={})

    return MealData(hall=hall, meal=meal, available=True, categories=categories)
