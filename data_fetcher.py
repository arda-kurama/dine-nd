import os
import sys
import json
import re
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed
from itertools import product
from collections import defaultdict, namedtuple

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, WebDriverException, TimeoutException

from bs4 import BeautifulSoup

# GLOBAL VARS
HALLS = [
    "Holy Cross College Dining Hall",
    "North Dining Hall", 
    "Saint Mary's Dining Hall",
    "South Dining Hall",
]

PREFIX = {
    "North Dining Hall":      "NDH",
    "South Dining Hall":      "SDH",
    "Saint Mary's Dining Hall":"SMC",
    "Holy Cross College Dining Hall": "HCC",
}

HALL_MAPPING = {
    "NDH": "North Dining Hall",
    "SDH": "South Dining Hall", 
    "SMC": "Saint Mary's Dining Hall",
    "HCC": "Holy Cross College Dining Hall"
}

EXPECTED_MEALS = ["Breakfast", "Lunch", "Late Lunch", "Dinner"]
# DATE_STR = datetime.now().strftime("%A, %B %-d, %Y")
DATE_STR = "Friday, May 30, 2025"
URL = "https://netnutrition.cbord.com/nn-prod/ND"

# Data structures for in-memory processing
FoodItem = namedtuple('FoodItem', ['name', 'serving_size', 'nutrition', 'daily_values', 'ingredients', 'allergens'])
MealData = namedtuple('MealData', ['hall', 'meal', 'available', 'categories'])

# SELENIUM SETUP
def make_chrome():
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--blink-settings=imagesEnabled=false")
    
    # Essential for cloud environments
    opts.add_argument("--disable-background-timer-throttling")
    opts.add_argument("--disable-backgrounding-occluded-windows")
    opts.add_argument("--disable-renderer-backgrounding")
    
    # Use system ChromeDriver (no webdriver-manager)
    service = Service("/usr/bin/chromedriver")
    return webdriver.Chrome(service=service, options=opts)

def extract_numeric_value(value_str):
    """Extract numeric calories value for easier sorting/filtering"""
    if isinstance(value_str, str):
        match = re.search(r'(\d+)', value_str)
        return int(match.group(1)) if match else 0
    return 0

def parse_nutrition_html(html_content):
    """Parse nutrition label HTML and return structured data"""
    soup = BeautifulSoup(html_content, "html.parser")

    # Extract the name of the food
    name_tag = soup.find("td", class_="cbo_nn_LabelHeader")
    name = name_tag.get_text(strip=True) if name_tag else "Unknown"

    # Extract the serving size information
    serving_tag = soup.find("td", class_="cbo_nn_LabelBottomBorderLabel")
    serving_size = serving_tag.get_text(strip=True).replace("Serving Size:", "").replace('\xa0', ' ').strip()

    # Hardcoded nutrient names since all labels have the same structure
    nutrient_names = ["Calories", "Calories from Fat", "Total Fat", "Saturated Fat", "Cholesterol",
                      "Sodium", "Potassium", "Total Carbohydrate", "Dietary Fiber", "Sugars", "Protein"]

    # Extract nutrients from the nutrition label table
    nutrient_tags = soup.find_all("span", class_="cbo_nn_SecondaryNutrient")
    nutrients = [tag.get_text(strip=True) for tag in nutrient_tags]

    # Extract daily values from the nutrition label
    daily_value_tags = soup.find_all("td", class_="cbo_nn_LabelLeftPaddedDetail")
    daily_values = ["", ""] + [tag.get_text(strip=True) for tag in daily_value_tags]

    # Extract ingredients
    ingredient_tag = soup.find("span", class_="cbo_nn_LabelIngredients")
    ingredients = ingredient_tag.get_text(strip=True) if ingredient_tag else "Not Specified"

    # Extract allergens
    allergen_tag = soup.find("span", class_="cbo_nn_LabelAllergens")
    allergens = allergen_tag.get_text(strip=True).replace('\xa0', ' ') if allergen_tag else "Not Specified"

    # Build nutrition dictionary
    nutrition_dict = {}
    for i, nutrient_name in enumerate(nutrient_names):
        nutrient_amount = nutrients[i] if i < len(nutrients) else "N/A"
        daily_value = daily_values[i] if i < len(daily_values) else "N/A"
        nutrition_dict[nutrient_name] = {
            "amount": nutrient_amount,
            "daily_value": daily_value,
        }

    # Return structured data in final format
    return {
        "name": name,
        "serving_size": serving_size,
        "nutrition": {
            "calories": extract_numeric_value(nutrition_dict.get("Calories", {}).get("amount", "0")),
            "total_fat": nutrition_dict.get("Total Fat", {}).get("amount", "N/A"),
            "saturated_fat": nutrition_dict.get("Saturated Fat", {}).get("amount", "N/A"),
            "cholesterol": nutrition_dict.get("Cholesterol", {}).get("amount", "N/A"),
            "sodium": nutrition_dict.get("Sodium", {}).get("amount", "N/A"),
            "total_carbs": nutrition_dict.get("Total Carbohydrate", {}).get("amount", "N/A"),
            "dietary_fiber": nutrition_dict.get("Dietary Fiber", {}).get("amount", "N/A"),
            "sugars": nutrition_dict.get("Sugars", {}).get("amount", "N/A"),
            "protein": nutrition_dict.get("Protein", {}).get("amount", "N/A")
        },
        "daily_values": {
            "total_fat": nutrition_dict.get("Total Fat", {}).get("daily_value", "N/A"),
            "saturated_fat": nutrition_dict.get("Saturated Fat", {}).get("daily_value", "N/A"),
            "cholesterol": nutrition_dict.get("Cholesterol", {}).get("daily_value", "N/A"),
            "sodium": nutrition_dict.get("Sodium", {}).get("daily_value", "N/A"),
            "total_carbs": nutrition_dict.get("Total Carbohydrate", {}).get("daily_value", "N/A"),
            "dietary_fiber": nutrition_dict.get("Dietary Fiber", {}).get("daily_value", "N/A")
        },
        "ingredients": ingredients,
        "allergens": allergens
    }

# Helper to find all meal links for a specific hall (with error handling)
def get_meal_links_for_hall(hall):
    """Get meal links for a single hall, returning empty list on failure"""
    driver = None
    try:
        driver = make_chrome()
        wait = WebDriverWait(driver, 5)
        
        print(f"Checking {hall}...")
        driver.get(URL)
        
        # Click the hall link
        wait.until(EC.element_to_be_clickable((By.LINK_TEXT, hall))).click()
        
        # Wait for the meal-list table to load
        wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "cbo_nn_menuCell")))
        
        # Find the specific date cell
        try:
            cell = driver.find_element(
                By.XPATH,
                f"//td[@class='cbo_nn_menuCell'][contains(normalize-space(.), '{DATE_STR}')]"
            )
        except NoSuchElementException:
            print(f"  No menu available for {DATE_STR}")
            return []
        
        # Grab all meal links
        links = cell.find_elements(By.CSS_SELECTOR, "a.cbo_nn_menuLink")
        if not links:
            print(f"  No meals found for {DATE_STR}")
            return []
            
        meals = [a.text.strip() for a in links]
        print(f"  ✓ Found {len(meals)} meals: {', '.join(meals)}")
        return [(hall, meal) for meal in meals]
        
    except TimeoutException:
        print(f"  Timeout loading {hall}")
        return []
    except WebDriverException as e:
        print(f"  Browser connection failed")
        return []
    except Exception as e:
        print(f"  Unexpected error: {type(e).__name__}")
        return []
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

# Improved discovery that handles individual hall failures
def discover_tasks_resilient():
    """Discover tasks with per-hall error handling"""
    all_tasks = []
    
    for hall in HALLS:
        hall_tasks = get_meal_links_for_hall(hall)
        all_tasks.extend(hall_tasks)
    
    return all_tasks

# Create fallback tasks for halls that failed discovery
def create_fallback_tasks(discovered_tasks):
    """Create fallback tasks for missing hall/meal combinations"""
    discovered_combinations = set(discovered_tasks)
    fallback_tasks = []
    
    for hall, meal in product(HALLS, EXPECTED_MEALS):
        if (hall, meal) not in discovered_combinations:
            fallback_tasks.append((hall, meal))
    
    return fallback_tasks

# Memory-optimized scraper that returns data instead of writing files
def scrape_one_memory_optimized(hall, meal):
    """Scrape and return structured data directly (no file I/O)"""
    driver = None
    try:        
        # Launch new Chrome session
        driver = make_chrome()
        wait = WebDriverWait(driver, 5)
        driver.get(URL)

        # Select hall
        wait.until(EC.element_to_be_clickable((By.LINK_TEXT, hall))).click()
        wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "td.cbo_nn_menuCell")))

        # Try to find the meal link
        try:
            date_cell = driver.find_element(
                By.XPATH,
                f"//td[@class='cbo_nn_menuCell'][contains(normalize-space(.), '{DATE_STR}')]"
            )
            meal_link = date_cell.find_element(By.LINK_TEXT, meal)
            meal_link.click()
        except NoSuchElementException:
            # Meal doesn't exist for this hall/date
            return MealData(hall=hall, meal=meal, available=False, categories={})

        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "cbo_nn_itemGridTable")))

        # Grab the table of rows (group headers and item rows)
        table = driver.find_element(By.CLASS_NAME, "cbo_nn_itemGridTable")
        rows = table.find_elements(By.TAG_NAME, "tr")

        current_group = None
        categories = defaultdict(list)
        items_scraped = 0
        
        for row in rows:
            try:
                # Check if row is a group header
                group_cells = row.find_elements(By.CSS_SELECTOR, "td.cbo_nn_itemGroupRow")
                if group_cells:
                    grp_name = group_cells[0].text.strip()
                    sanitized = grp_name.replace(' ', '_').replace('/', '_') or 'Ungrouped'
                    current_group = sanitized.replace('_', ' ').title()  # Clean name for display
                    continue

                # Otherwise check if it is an item row
                item_cells = row.find_elements(By.CSS_SELECTOR, "td.cbo_nn_itemHover")
                if not item_cells:
                    continue

                # Click on the item and extract its nutrition label
                item_td = item_cells[0]
                driver.execute_script("arguments[0].scrollIntoView(true);", item_td)
                item_td.click()
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#nutritionLabelPanel table")))

                # Extract HTML and parse it directly in memory
                html = driver.find_element(By.ID, "nutritionLabelPanel").get_attribute("outerHTML")
                food_item = parse_nutrition_html(html)
                
                # Add to categories
                category_name = current_group or 'Ungrouped'
                categories[category_name].append(food_item)

                # Close nutrition label
                driver.find_element(By.CSS_SELECTOR, "#nutritionLabelPanel button.cbo_nn_closeButton").click()
                items_scraped += 1
                
            except Exception as e:
                # Continue with next item instead of failing entire meal
                continue

        print(f"✓ {hall} - {meal}: {items_scraped} items")
        return MealData(hall=hall, meal=meal, available=True, categories=dict(categories))

    except Exception as e:
        print(f"✗ {hall} - {meal}: Failed ({type(e).__name__})")
        return MealData(hall=hall, meal=meal, available=False, categories={})
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

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

if __name__ == "__main__":
    print(f"🚀 Starting memory-optimized scraping for {DATE_STR}...")
    
    # Discover available meals
    discovered_tasks = discover_tasks_resilient()
    
    if not discovered_tasks:
        print("No meals to scrape - exiting")
        sys.exit(1)

    print(f"\n✓ Found {len(discovered_tasks)} available meals to scrape")
    
    # Create fallback tasks for missing combinations  
    fallback_tasks = create_fallback_tasks(discovered_tasks)
    all_tasks = discovered_tasks + [(hall, meal, False) for hall, meal in fallback_tasks]  # Mark fallbacks
    
    print(f"🔄 Starting parallel scraping of {len(discovered_tasks)} meals...")
    
    # Parallelize the scrape with memory optimization
    meal_data_results = []
    
    with ProcessPoolExecutor(max_workers=min(os.cpu_count(), len(discovered_tasks))) as executor:
        # Submit all scraping jobs
        futures = [
            executor.submit(scrape_one_memory_optimized, hall, meal)
            for hall, meal in discovered_tasks
        ]
        
        # Add fallback "no menu" entries
        for hall, meal in fallback_tasks:
            meal_data_results.append(MealData(hall=hall, meal=meal, available=False, categories={}))

        # Wait for completion and collect results
        completed = 0
        failed = 0
        for future in as_completed(futures):
            try:
                result = future.result()
                meal_data_results.append(result)
                completed += 1
            except Exception as e:
                failed += 1
                print(f"Unhandled task error: {e}")

    print(f"\n🔄 Consolidating {len(meal_data_results)} meal datasets...")
    
    # Consolidate all data in memory
    consolidated_data = consolidate_meal_data(meal_data_results)
    
    # Write final outputs
    output_file = "consolidated_menu.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(consolidated_data, f, indent=2, ensure_ascii=False)
    
    # Create and write lightweight summary
    lightweight_data = create_lightweight_summary(consolidated_data)
    summary_file = "menu_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(lightweight_data, f, indent=2)

    print(f"\n{'='*70}")
    print(f"🎉 MEMORY-OPTIMIZED SCRAPING COMPLETE")
    print(f"{'='*70}")
    print(f"✅ Successfully processed: {completed} meals")
    if failed > 0:
        print(f"✗ Failed: {failed} meals")
    print(f"📊 Summary: {consolidated_data['summary']}")
    print(f"📱 Full menu data: {output_file} (~{os.path.getsize(output_file) / 1024:.1f} KB)")
    print(f"⚡ Lightweight summary: {summary_file} (~{os.path.getsize(summary_file) / 1024:.1f} KB)")
    print("🚀 Ready for React Native deployment!")