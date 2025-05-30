from datetime import datetime
from .constants import PREFIX, HALL_MAPPING, DATE_STR

def consolidate_meal_data(meal_data_list):
    """Consolidate scraped meal data into final JSON structure"""
    
    consolidated_data = {
        "last_updated": datetime.now().isoformat(),
        "date": DATE_STR,
        "dining_halls": {}
    }
    
    # Process each meal's data
    for meal_data in meal_data_list:
        if not meal_data:  # Skip None results
            continue
            
        hall_name = HALL_MAPPING.get(PREFIX.get(meal_data.hall, ""), meal_data.hall)
        
        # Initialize hall structure if needed
        if hall_name not in consolidated_data["dining_halls"]:
            consolidated_data["dining_halls"][hall_name] = {}
        
        # Store the meal data
        if meal_data.available:
            consolidated_data["dining_halls"][hall_name][meal_data.meal] = {
                "available": True,
                "categories": meal_data.categories
            }
        else:
            consolidated_data["dining_halls"][hall_name][meal_data.meal] = {
                "available": False,
                "categories": {}
            }
    
    # Generate summary statistics
    def generate_summary(dining_halls):
        total_halls = len(dining_halls)
        total_meals = 0
        total_items = 0
        available_meals = 0
        
        for hall_name, meals in dining_halls.items():
            total_meals += len(meals)
            for meal_name, meal_data in meals.items():
                if meal_data.get("available", False):
                    available_meals += 1
                    for category_name, items in meal_data.get("categories", {}).items():
                        total_items += len(items)
        
        return {
            "total_dining_halls": total_halls,
            "total_meal_periods": total_meals,
            "available_meal_periods": available_meals,
            "total_food_items": total_items
        }
    
    consolidated_data["summary"] = generate_summary(consolidated_data["dining_halls"])
    return consolidated_data

def create_lightweight_summary(consolidated_data):
    """Create lightweight summary for React Native initial load"""
    
    lightweight = {
        "last_updated": consolidated_data["last_updated"],
        "date": consolidated_data["date"],
        "dining_halls": {}
    }
    
    for hall_name, meals in consolidated_data["dining_halls"].items():
        lightweight["dining_halls"][hall_name] = {}
        
        for meal_name, meal_data in meals.items():
            if meal_data.get("available", False):
                category_count = len(meal_data.get("categories", {}))
                item_count = sum(len(items) for items in meal_data.get("categories", {}).values())
                
                lightweight["dining_halls"][hall_name][meal_name] = {
                    "available": True,
                    "category_count": category_count,
                    "item_count": item_count,
                    "categories": list(meal_data.get("categories", {}).keys())
                }
            else:
                lightweight["dining_halls"][hall_name][meal_name] = {
                    "available": False
                }
    
    return lightweight
