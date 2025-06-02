from datetime import datetime
from .constants import PREFIX, HALL_MAPPING, DATE_STR, HALLS

def consolidate_meal_data(meal_data_list):
    """Consolidate scraped meal data into final JSON structure"""
    
    consolidated_data = {
        "last_updated": datetime.now().isoformat(),
        "date": DATE_STR,
        "dining_halls": {}
    }
    
    # 1) Populate halls that have at least one meal scraped 
    for meal_data in meal_data_list:
        if not meal_data:  # Skip None results
            continue
            
        hall_name = HALL_MAPPING.get(PREFIX.get(meal_data.hall, ""), meal_data.hall)
        
        # Initialize hall structure if needed
        if hall_name not in consolidated_data["dining_halls"]:
            consolidated_data["dining_halls"][hall_name] = {}
        
        # Store the meal data
        consolidated_data["dining_halls"][hall_name][meal_data.meal] = {
            "available": meal_data.available,
            "categories": meal_data.categories if meal_data.available else {},
        }

    # Ensure all halls are represented even if no meals were scraped
    for hall_name in HALLS:
        if hall_name not in consolidated_data["dining_halls"]:
            consolidated_data["dining_halls"][hall_name] = {}
    
    return consolidated_data

def create_lightweight_summary(consolidated_data):
    """Create lightweight summary for React Native initial load"""
    
    lightweight = {
        "last_updated": consolidated_data["last_updated"],
        "date": consolidated_data["date"],
        "dining_halls": {}
    }

    # Count meals for all halls
    for hall_name, meals in consolidated_data["dining_halls"].items():
        meal_count = len(meals)
        lightweight["dining_halls"][hall_name] = meal_count
    
    return lightweight
