import os
import shutil
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# GLOBAL VARS
HALLS = [
    "Holy Cross College Dining Hall",
    "North Dining Hall",
    "Saint Mary's Dining Hall",
    "South Dining Hall",
]

BASE_DIR = "all_nutrition_data"
# DATE_STR = datetime.now().strftime("%A, %B %-d, %Y")
DATE_STR = "Tuesday, April 22, 2025"
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
    return webdriver.Chrome(options=opts)

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

# Scrape one task
def scrape_one(hall, meal):
    # Setup output directory for nutrition labels
    if hall == "North Dining Hall":
        out_dir = os.path.join(BASE_DIR, f"NDH_{meal.replace(' ', '_')}")
    elif hall == "South Dining Hall":
        out_dir = os.path.join(BASE_DIR, f"SDH_{meal.replace(' ', '_')}")
    elif hall == "Saint Mary's Dining Hall":
        out_dir = os.path.join(BASE_DIR, f"SMC_{meal.replace(' ', '_')}")
    elif hall == "Holy Cross College Dining Hall":
        out_dir = os.path.join(BASE_DIR, f"HCC_{meal.replace(' ', '_')}")
    os.makedirs(out_dir, exist_ok=True)

    # Launch Chrome
    driver = make_chrome()

    # Fast wait config
    wait = WebDriverWait(driver, 3)

    # Visit NetNutrition
    driver.get(URL)

    # Select the hall
    wait.until(EC.element_to_be_clickable((By.LINK_TEXT, hall))).click()
    wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "td.cbo_nn_menuCell")))

    # Locate the date cell that holds our meals
    date_cell = driver.find_element(
        By.XPATH,
        f"//td[@class='cbo_nn_menuCell'][contains(normalize-space(.), '{DATE_STR}')]"
    )

    # Find the link for this meal by its link text
    meal_link = date_cell.find_element(By.LINK_TEXT, meal)
    wait.until(EC.element_to_be_clickable((By.LINK_TEXT, meal)))
    meal_link.click()

    # Wait for the items to show
    wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "cbo_nn_itemHover")))

    # Get all items on page
    items = driver.find_elements(By.CLASS_NAME, "cbo_nn_itemHover")

    # Loop through all items
    for idx, item in enumerate(items):
        # Scroll item into view so click() actually hits
        driver.execute_script("arguments[0].scrollIntoView(true);", item)

        # Click item
        item.click()

        # Wait for the table inside the nutrition panel, not just the wrapper div
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#nutritionLabelPanel table")))

        # Grab the filled panel HTML
        html = driver.find_element(By.ID, "nutritionLabelPanel").get_attribute("outerHTML")

        # Save the panel HTML to a file
        with open(os.path.join(out_dir, f"label_{idx}.html"), "w", encoding="utf-8") as f:
            f.write(html)

        # Close the label
        driver.find_element(By.CSS_SELECTOR, "#nutritionLabelPanel button.cbo_nn_closeButton").click()

    driver.quit()

if __name__ == "__main__":
    # Nuke all old directories to prevent stale data
    if os.path.isdir(BASE_DIR):
        shutil.rmtree(BASE_DIR)
    os.makedirs(BASE_DIR)

    # Build [(hall, meal), …] argument list for parallelization
    tasks = discover_tasks()

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