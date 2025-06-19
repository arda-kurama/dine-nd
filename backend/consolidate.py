"""
Module for merging and summarizing scraped dining-hall meal data.

This file provides two core functions:
- consolidate_meal_data: Combine a list of MealData objects into a single
  consolidated menu dict with a timestamp, date, and per-hall/meal/category structure.
- create_lightweight_summary: Produce a simplified summary mapping each
  dining hall to the count of meals available.
"""

from datetime import datetime
from typing import List, Dict, Any
from .constants import DATE_STR, HALLS, MealData

def consolidate_meal_data(meal_data_list: List[MealData]) -> Dict[str, Any]:
    """
    Combine a list of MealData objects into one dictionary:
      {
        "last_updated": <ISO-timestamp>,
        "date": <DATE_STR>,
        "dining_halls": {
           <hall_name>: {
             <meal_name>: {
               "available": bool,
               "categories": {...}
             },
             …
           },
           …
        }
      }
    Any hall in HALLS that has no MealData entries is still included with an empty dict.
    """

    consolidated_data = {
        "last_updated": datetime.now().isoformat(),
        "date": DATE_STR,
        "dining_halls": {}
    }
    
    # Populate halls that have at least one meal scraped 
    for meal_data in meal_data_list:
        if not meal_data:
            continue

        hall_name = meal_data.hall

        # Ensure a dict exists for hall_name, and assign meal data under that hall
        hall_dict = consolidated_data["dining_halls"].setdefault(hall_name, {})
        hall_dict[meal_data.meal] = {
            "available": meal_data.available,
            "categories": meal_data.categories if meal_data.available else {},
        }

    # Ensure all halls are represented even if no meals were scraped
    for hall_name in HALLS:
        consolidated_data["dining_halls"].setdefault(hall_name, {})

    return consolidated_data

def create_lightweight_summary(consolidated_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build a summary mapping each dining hall to the number of meals available:
      {
        "last_updated": <same as consolidated_data>,
        "date": <same as consolidated_data>,
        "dining_halls": {
          <hall_name>: <meal_count>,
          …
        }
      }
    """

    # Initialize the lightweight summary structure 
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
