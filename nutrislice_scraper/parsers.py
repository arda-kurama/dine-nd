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

    # Build station_id -> station name map (Nutrislice usually includes this)
    station_name_by_id: Dict[str, str] = {}

    def _ingest_stations(stations_obj: Any) -> None:
        if not isinstance(stations_obj, list):
            return
        for st in stations_obj:
            if not isinstance(st, dict):
                continue
            sid = st.get("id")
            name = st.get("name") or st.get("text") or st.get("title")
            if sid is None or not name:
                continue
            station_name_by_id[str(sid)] = str(name).strip()

    _ingest_stations(day_json.get("stations"))
    menu_info = day_json.get("menu_info")
    if isinstance(menu_info, dict):
        _ingest_stations(menu_info.get("stations"))

    categories = defaultdict(list)
    current_section = None

    def _is_header_row(it: Dict[str, Any]) -> bool:
        txt = (it.get("text") or "").strip()
        if not txt:
            return False
        # header rows usually have no food dict
        if isinstance(it.get("food"), dict):
            return False
        # Nutrislice is inconsistent: any is_* flag might be used
        for k, v in it.items():
            if k.startswith("is_") and v is True:
                return True
        # fallback: text row with no food
        return True

    for it in items:
        if not isinstance(it, dict):
            continue

        # Update current_section if we hit a header row
        if _is_header_row(it):
            txt = (it.get("text") or "").strip()
            if txt:
                current_section = txt
            continue

        food = it.get("food")
        if not isinstance(food, dict):
            continue

        name = (food.get("name") or "").strip() or "Unknown"

        # Serving size
        serving_size = "Not Specified"
        s_info = food.get("serving_size_info")
        if isinstance(s_info, dict):
            amt = s_info.get("serving_size_amount")
            unit = s_info.get("serving_size_unit")
            if amt or unit:
                serving_size = f"{amt or ''} {unit or ''}".strip()

        # Nutrition (keep your existing output shape)
        rni = food.get("rounded_nutrition_info") or {}
        def g(key):
            return rni.get(key)

        nutrition = {
            "calories": int(g("calories") or 0),
            "calories_from_fat": int(g("calories_from_fat") or 0) if g("calories_from_fat") is not None else 0,
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

        # Allergens (icons)
        allergens: List[str] = []
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

        # The actual fix: group by station_id if present
        station_name = None
        station_id = it.get("station_id")
        if station_id is not None:
            station_name = station_name_by_id.get(str(station_id))

        group = (station_name or current_section or "Ungrouped").strip()

        categories[group].append({
            "name": name,
            "serving_size": serving_size,
            "nutrition": nutrition,
            "daily_values": {},
            "ingredients": ingredients,
            "allergens": allergens_txt,
        })

    return dict(categories)
