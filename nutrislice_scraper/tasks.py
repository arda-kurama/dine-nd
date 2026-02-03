from datetime import datetime
from typing import List, Tuple

from .constants import (
    DATE_ISO,
    NUTRISLICE_SCHOOLS,
    NUTRISLICE_MENU_TYPES,
    MENU_TYPE_DISPLAY,
)
from .nutrislice_client import NutrisliceRef, fetch_week, extract_day


def discover_all_meal_tasks() -> List[Tuple[str, str]]:
    tasks: List[Tuple[str, str]] = []

    y, m, d = map(int, DATE_ISO.split("-"))
    day_obj = datetime(y, m, d).date()

    for hall_name, school_slug in NUTRISLICE_SCHOOLS.items():
        for menu_type_slug in NUTRISLICE_MENU_TYPES:
            ref = NutrisliceRef(school_slug=school_slug, menu_type_slug=menu_type_slug, day=day_obj)
            week_json = fetch_week(ref)
            if not week_json:
                continue

            day_json = extract_day(week_json, DATE_ISO)
            if not day_json:
                continue

            items = day_json.get("menu_items", [])
            has_food = False
            if isinstance(items, list):
                for it in items:
                    if isinstance(it, dict) and isinstance(it.get("food"), dict):
                        has_food = True
                        break

            if has_food:
                tasks.append((hall_name, MENU_TYPE_DISPLAY.get(menu_type_slug, menu_type_slug)))

    return tasks
