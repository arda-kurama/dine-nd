import os
import sys
import shutil
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed
from itertools import product
import subprocess
import traceback

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, WebDriverException, TimeoutException

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

EXPECTED_MEALS = ["Breakfast", "Lunch", "Late Lunch", "Dinner"]

BASE_DIR = "all_nutrition_data"
DATE_STR = "Friday, May 30, 2025"
URL      = "https://netnutrition.cbord.com/nn-prod/ND"

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

# Helper to find all meal links for a specific hall (with error handling)
def get_meal_links_for_hall(hall):
    """Get meal links for a single hall, returning empty list on failure"""
    driver = None
    try:
        driver = make_chrome()
        wait = WebDriverWait(driver, 5)  # Slightly longer timeout
        
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
        if "Message:" in str(e) and str(e).split("Message:")[1].strip():
            error_msg = str(e).split("Message:")[1].split("\n")[0].strip()
            print(f"  Browser error: {error_msg}")
        else:
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
                pass  # Suppress quit errors

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

# Scrape one (hall, meal) with better error handling
def scrape_one_resilient(hall, meal):
    """Scrape with individual error handling and reporting"""
    prefix = PREFIX[hall]
    base_out = os.path.join(BASE_DIR, f"{prefix}_{meal.replace(' ', '_')}")
    os.makedirs(base_out, exist_ok=True)

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
            marker = os.path.join(base_out, "NO_MENU.txt")
            with open(marker, "w", encoding="utf-8") as f:
                f.write(f"No {meal} menu available at {hall} on {DATE_STR}\n")
            return

        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "cbo_nn_itemGridTable")))

        # Grab the table of rows (group headers and item rows)
        table = driver.find_element(By.CLASS_NAME, "cbo_nn_itemGridTable")
        rows = table.find_elements(By.TAG_NAME, "tr")

        current_group = None
        items_scraped = 0
        
        for row in rows:
            try:
                # Check if row is a group header
                group_cells = row.find_elements(By.CSS_SELECTOR, "td.cbo_nn_itemGroupRow")
                if group_cells:
                    grp_name = group_cells[0].text.strip()
                    sanitized = grp_name.replace(' ', '_').replace('/', '_') or 'Ungrouped'
                    current_group = sanitized
                    continue

                # Otherwise check if it is an item row
                item_cells = row.find_elements(By.CSS_SELECTOR, "td.cbo_nn_itemHover")
                if not item_cells:
                    continue

                # Make sure subdirectory for this group exists
                group_dir = os.path.join(base_out, current_group or 'Ungrouped')
                os.makedirs(group_dir, exist_ok=True)

                # Click on the item and extract its nutrition label
                item_td = item_cells[0]
                driver.execute_script("arguments[0].scrollIntoView(true);", item_td)
                item_td.click()
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#nutritionLabelPanel table")))

                # Extract HTML and save it to a file
                html = driver.find_element(By.ID, "nutritionLabelPanel").get_attribute("outerHTML")
                idx = len([f for f in os.listdir(group_dir) if f.startswith('label_')])
                with open(os.path.join(group_dir, f"label_{idx}.html"), 'w', encoding='utf-8') as f:
                    f.write(html)

                # Close nutrition label
                driver.find_element(By.CSS_SELECTOR, "#nutritionLabelPanel button.cbo_nn_closeButton").click()
                items_scraped += 1
                
            except Exception as e:
                # Continue with next item instead of failing entire meal
                continue

        print(f"✓ {hall} - {meal}: {items_scraped} items")

    except Exception as e:
        print(f"✗ {hall} - {meal}: Failed ({type(e).__name__})")
        # Create error marker
        error_file = os.path.join(base_out, "SCRAPE_ERROR.txt")
        with open(error_file, "w", encoding="utf-8") as f:
            f.write(f"Error scraping {meal} at {hall} on {DATE_STR}\n")
            f.write(f"Error: {e}\n")
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

if __name__ == "__main__":
    # Nuke all old directories to prevent stale data
    if os.path.isdir(BASE_DIR):
        shutil.rmtree(BASE_DIR)
    os.makedirs(BASE_DIR)

    print(f"Discovering available meals for {DATE_STR}...")
    
    # Discover tasks with individual hall error handling
    discovered_tasks = discover_tasks_resilient()
    
    if discovered_tasks:
        print(f"\n✓ Found {len(discovered_tasks)} available meals to scrape")
    else:
        print("\n⚠ No meals found for any dining hall")
    
    # Create fallback tasks for missing combinations
    fallback_tasks = create_fallback_tasks(discovered_tasks)
    if fallback_tasks:        
        # Create NO_MENU markers for combinations that weren't discovered
        for hall, meal in fallback_tasks:
            prefix = PREFIX[hall]
            meal_safe = meal.replace(" ", "_")
            combo_dir = os.path.join(BASE_DIR, f"{prefix}_{meal_safe}")
            os.makedirs(combo_dir, exist_ok=True)
            
            marker = os.path.join(combo_dir, "NO_MENU.txt")
            with open(marker, "w", encoding="utf-8") as f:
                f.write(f"No {meal} menu available at {hall} on {DATE_STR}\n")

    if not discovered_tasks:
        print("No meals to scrape - exiting")
        sys.exit(1)

    # Parallelize the scrape of discovered tasks
    print(f"\nStarting scraping...")
    
    with ProcessPoolExecutor(max_workers=min(os.cpu_count(), len(discovered_tasks))) as executor:
        # Submit all jobs
        futures = [
            executor.submit(scrape_one_resilient, hall, meal)
            for hall, meal in discovered_tasks
        ]

        # Wait for completion and report results
        completed = 0
        failed = 0
        for future in as_completed(futures):
            try:
                future.result()
                completed += 1
            except Exception as e:
                failed += 1
                print(f"Unhandled task error: {e}")

    print(f"\n{'='*50}")
    print(f"SCRAPING COMPLETE")
    print(f"{'='*50}")
    print(f"✓ Successfully scraped: {completed} meals")
    if failed > 0:
        print(f"✗ Failed: {failed} meals")
    print(f"📁 Results saved to: {BASE_DIR}")