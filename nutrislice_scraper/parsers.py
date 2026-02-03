from typing import Dict, Any, List
from collections import defaultdict


KNOWN_ALLERGENS = {
    "eggs", "fish", "milk", "peanuts", "pork", "sesame", "sesame seed",
    "shellfish", "soy", "tree nuts", "wheat",
}


def parse_nutrislice_day_to_categories(day_json: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    items = day_json.get("menu_items", [])
    if not isinstance(items, list):
        return {}

    categories = defaultdict(list)
    current_section = None

    for it in items:
        if not isinstance(it, dict):
            continue

        # Section headers
        if it.get("is_section_title") or it.get("is_station_header"):
            txt = (it.get("text") or "").strip()
            if txt:
                current_section = txt
            continue

        food = it.get("food")
        if not isinstance(food, dict):
            continue

        name = (food.get("name") or "").strip() or "Unknown"

        # Serving size (best-effort)
        serving_size = "Not Specified"
        s_info = food.get("serving_size_info")
        if isinstance(s_info, dict):
            amt = s_info.get("serving_size_amount")
            unit = s_info.get("serving_size_unit")
            if amt or unit:
                serving_size = f"{amt or ''} {unit or ''}".strip()

        # Nutrition (best-effort, many keys exist in rounded_nutrition_info)
        rni = food.get("rounded_nutrition_info") or {}
        def g(key): return rni.get(key)
        nutrition = {
            "calories": int(g("calories") or 0),
            "calories_from_fat": 0,
            "total_fat": f"{g('g_fat') or 0:g}g",
            "saturated_fat": f"{g('g_saturated_fat') or 0:g}g",
            "cholesterol": f"{g('mg_cholesterol') or 0:g}mg",
            "sodium": f"{g('mg_sodium') or 0:g}mg",
            "potassium": f"{g('mg_potassium') or 0:g}mg",
            "total_carbohydrate": f"{g('g_carbs') or 0:g}g",
            "dietary_fiber": f"{g('g_fiber') or 0:g}g",
            "sugars": f"{g('g_sugar') or 0:g}g",
            "protein": f"{g('g_protein') or 0:g}g",
        }

        # Allergens via icons (best-effort)
        allergens = []
        icons = food.get("icons") or {}
        food_icons = icons.get("food_icons") if isinstance(icons, dict) else None
        if isinstance(food_icons, list):
            for ic in food_icons:
                if not isinstance(ic, dict):
                    continue
                synced = (ic.get("synced_name") or ic.get("name") or "").strip().lower()
                slug = (ic.get("slug") or "").strip().lower()
                if synced in KNOWN_ALLERGENS:
                    allergens.append(synced)
                elif slug in KNOWN_ALLERGENS:
                    allergens.append(slug)

        allergens_txt = ", ".join(sorted(set(allergens))) if allergens else "Not Specified"
        ingredients = (food.get("ingredients") or "").strip() or "Not Specified"

        group = (current_section or "Ungrouped").strip()
        categories[group].append({
            "name": name,
            "serving_size": serving_size,
            "nutrition": nutrition,
            "daily_values": {},
            "ingredients": ingredients,
            "allergens": allergens_txt,
        })

    return dict(categories)
