import os
import sys
import shutil
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed
from itertools import product
import subprocess

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, WebDriverException

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
# DATE_STR = datetime.now().strftime("%A, %B %-d, %Y")
DATE_STR = "Friday, May 30, 2025"
URL      = "https://netnutrition.cbord.com/nn-prod/ND"

# SELENIUM SETUP
def make_chrome():
    opts = Options()
    # opts.add_argument("--headless")
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

# Helper to find all meal links
def get_meal_links(driver, wait):
    # Find the specific <td class="cbo_nn_menuCell"> whose text block contains date_str
    cell = driver.find_element(
        By.XPATH,
        f"//td[@class='cbo_nn_menuCell'][contains(normalize-space(.), '{DATE_STR}')]"
    )

    # Grab all of the <a class="cbo_nn_menuLink"> inside it
    links = cell.find_elements(By.CSS_SELECTOR, "a.cbo_nn_menuLink")
    if not links:
        raise RuntimeError(f"No meals found for {DATE_STR}")
    return [a.text.strip() for a in links]

# Helper to discover all tasks (hall, meal)
def discover_tasks():
    # Launch Chrome
    driver = make_chrome()

    # Fast wait config
    wait = WebDriverWait(driver, 3)

    # Visit NetNutrition
    print(f"Visiting {URL}")
    driver.get(URL)

    tasks = []
    for hall in HALLS:
        # Wait for and click the hall link
        wait.until(EC.element_to_be_clickable((By.LINK_TEXT, hall))).click()

        # Wait for the meal-list table to load
        wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "cbo_nn_menuCell")))

        # Extract today’s meals
        meals = get_meal_links(driver, wait)
        tasks.extend((hall, meal) for meal in meals)

        # Click the in‑page “Back to Dining Hall list” button
        back_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn_BackmenuList2")))
        back_btn.click()

        # Wait for the hall list to be clickable again (fresh elements)
        next_index = HALLS.index(hall) + 1
        if next_index < len(HALLS):
            next_hall = HALLS[next_index]
            wait.until(EC.element_to_be_clickable((By.LINK_TEXT, next_hall)))

    driver.quit()
    return tasks

# Scrape one (hall, meal) with grouping by food line
def scrape_one(hall, meal):
    # Setup directories for output
    prefix = {
        "North Dining Hall": "NDH",
        "South Dining Hall": "SDH",
        "Saint Mary's Dining Hall": "SMC",
        "Holy Cross College Dining Hall": "HCC",
    }[hall]
    base_out = os.path.join(BASE_DIR, f"{prefix}_{meal.replace(' ', '_')}")
    os.makedirs(base_out, exist_ok=True)

    # Launch new Chrome session
    driver = make_chrome()
    wait = WebDriverWait(driver, 3)
    driver.get(URL)

    # Select hall
    wait.until(EC.element_to_be_clickable((By.LINK_TEXT, hall))).click()
    wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "td.cbo_nn_menuCell")))

    # Locate the date cell and the meal links inside of it 
    date_cell = driver.find_element(
        By.XPATH,
        f"//td[@class='cbo_nn_menuCell'][contains(normalize-space(.), '{DATE_STR}')]"
    )
    meal_link = date_cell.find_element(By.LINK_TEXT, meal)
    wait.until(EC.element_to_be_clickable((By.LINK_TEXT, meal))).click()
    wait.until(EC.presence_of_element_located((By.CLASS_NAME, "cbo_nn_itemGridTable")))

    # Grab the table of rows (group headers and item rows)
    table = driver.find_element(By.CLASS_NAME, "cbo_nn_itemGridTable")
    rows = table.find_elements(By.TAG_NAME, "tr")

    current_group = None
    for row in rows:
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

    # Finished with this meal, close the browser session
    driver.quit()

if __name__ == "__main__":
    # Nuke all old directories to prevent stale data
    if os.path.isdir(BASE_DIR):
        shutil.rmtree(BASE_DIR)
    os.makedirs(BASE_DIR)

    # Build [(hall, meal), …] argument list for parallelization
    try:
        tasks = discover_tasks()

    # Catch any errors in the discovery phase
    except (RuntimeError, NoSuchElementException, WebDriverException) as e:
        for hall, meal in product(HALLS, EXPECTED_MEALS):
            # Format the hall and meal names for the file system
            prefix = PREFIX[hall]
            meal_safe = meal.replace(" ", "_")

            # Create a directory for the meal
            combo_dir = os.path.join(BASE_DIR, f"{prefix}_{meal_safe}")
            os.makedirs(combo_dir, exist_ok=True)

            # Create a marker file indicating no menu was found
            marker = os.path.join(combo_dir, "NO_MENU.txt")
            with open(marker, "w", encoding="utf-8") as f:
                f.write(f"No {meal} menu available at {hall} on {DATE_STR}\n")
                f.write(f"Error: {e}\n")

        print(f"[!] No menus—wrote {len(HALLS)*len(EXPECTED_MEALS)} markers under {BASE_DIR}")
        sys.exit(0)

    # Parallelize the scrape
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as executor:
        # Submit all jobs at the same time 
        futures = [
            executor.submit(scrape_one, hall, meal)
            for hall, meal in tasks
        ]

        # Wait for them all and report any errors
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print("Error in task:", e)