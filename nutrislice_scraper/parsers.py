from typing import Dict, Any, List
from collections import defaultdict

KNOWN_ALLERGENS = {
    "eggs", "fish", "milk", "peanuts", "pork", "sesame", "sesame seed",
    "shellfish", "soy", "tree nuts", "wheat",
}

def _build_station_maps(day_json: Dict[str, Any]):
    """
    Returns:
      station_name_by_id: dict[id -> name]
      station_order_by_id: dict[id -> order] (best-effort)
    """
    station_name_by_id = {}

    candidates = []

    # Common shapes seen across Nutrislice responses
    for key in ("stations", "station_list"):
        v = day_json.get(key)
        if isinstance(v, list):
            candidates.append(v)

    mi = day_json.get("menu_info")
    if isinstance(mi, dict):
        v = mi.get("stations")
        if isinstance(v, list):
            candidates.append(v)

    for stations in candidates:
        for idx, st in enumerate(stations):
            if not isinstance(st, dict):
                continue
            sid = st.get("id") or st.get("station_id") or st.get("pk")
            name = (st.get("name") or st.get("text") or "").strip()
            if sid is None or not name:
                continue

            station_name_by_id[str(sid)] = name

    return station_name_by_id


def parse_nutrislice_day_to_categories(day_json: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    items = day_json.get("menu_items", [])
    if not isinstance(items, list):
        return {}

    station_name_by_id = _build_station_maps(day_json)

    categories = defaultdict(list)
    current_section = None

    for it in items:
        if not isinstance(it, dict):
            continue

        # Header rows
        if it.get("is_section_title") or it.get("is_station_header"):
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

        # Nutrition
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

        # Allergens via icons
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

        sid = it.get("station_id") or food.get("station_id")

        st = it.get("station")
        group = None

        # station can be an object like {"id": 12, "name": "Plant Based"}
        if sid is None and isinstance(st, dict):
            sid = st.get("id") or st.get("station_id")
            group = ((st.get("name") or st.get("text") or "").strip() or None)

        # or station can just be an ID
        elif sid is None and isinstance(st, (int, str)):
            sid = st

        if group is None and sid is not None:
            group = station_name_by_id.get(str(sid))

        if not group:
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
