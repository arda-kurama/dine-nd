from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
from datetime import datetime
import shutil
import glob
from concurrent.futures import ProcessPoolExecutor

def get_meal_links(driver, wait, date_str):
    # Wait for date/meal cells to load
    wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "td.cbo_nn_menuCell")))
    
    # Find the specific <td class="cbo_nn_menuCell"> whose text block contains date_str
    cell = driver.find_element(
        By.XPATH,
        f"//td[@class='cbo_nn_menuCell'][contains(normalize-space(.), '{date_str}')]"
    )
    
    # Grab all of the <a class="cbo_nn_menuLink"> inside it
    links = cell.find_elements(By.CSS_SELECTOR, "a.cbo_nn_menuLink")
    if not links:
        raise RuntimeError(f"No meal links found under {date_str}")
    return links

# Scrape all nutrition data for a given meal
def scrape_all_labels(driver, wait, meal_name, hall_name, BASE_DIR):
    # Format the meal name
    meal_name = meal_name.strip().replace(" ", "_")

    # Setup output directory for nutrition labels
    if hall_name == "North Dining Hall":
        OUTPUT_DIR = os.path.join(BASE_DIR, f"NDH_{meal_name}")
    elif hall_name == "South Dining Hall":
        OUTPUT_DIR = os.path.join(BASE_DIR, f"SDH_{meal_name}")
    elif hall_name == "Saint Mary's Dining Hall":
        OUTPUT_DIR = os.path.join(BASE_DIR, f"SMC_{meal_name}")
    elif hall_name == "Holy Cross College Dining Hall":
        OUTPUT_DIR = os.path.join(BASE_DIR, f"HC_{meal_name}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Get all items on page
    all_items = driver.find_elements(By.CLASS_NAME, "cbo_nn_itemHover")

    # Loop through all items
    for idx, item in enumerate(all_items):
        # Scroll item into view so click() actually hits
        driver.execute_script(f"arguments[0].scrollIntoView(true);", item)

        # Click item
        item.click()

        # Wait for the table inside the nutrition panel, not just the wrapper div
        wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "#nutritionLabelPanel table")
        ))

        # Grab the filled panel HTML
        panel = driver.find_element(By.ID, "nutritionLabelPanel")
        html = panel.get_attribute("outerHTML")

        # Save the panel HTML to a file 
        fn = os.path.join(OUTPUT_DIR, f"label_{idx}.html")
        with open(fn, "w", encoding="utf-8") as f:
            f.write(html)

        # Close the label 
        close_btn = driver.find_element(By.CSS_SELECTOR, "#nutritionLabelPanel button.cbo_nn_closeButton")
        close_btn.click()

# Nuke all old directories to prevent stale data
def delete_old_dirs(BASE_DIR):
    # Make base directory to store all nutrition data in
    if os.path.isdir(BASE_DIR):
        for dir in os.listdir(BASE_DIR):
            child_dir = os.path.join(BASE_DIR, dir)
            if os.path.isdir(child_dir):
                shutil.rmtree(child_dir)
    else:
        os.makedirs(BASE_DIR)

def scrape_hall(hall_name, BASE_DIR):
    # SELENIUM SETUP
    chrome_options = Options()
    chrome_options.add_argument("--headless")                  # run in background, required for parallelization
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--log-level=3")               # suppress logs
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--blink-settings=imagesEnabled=false")  # don't load images

    # Launch driver
    driver = webdriver.Chrome(options=chrome_options)

    # Fast wait config
    wait = WebDriverWait(driver, 3)

    # Visit NetNutrition
    driver.get("https://netnutrition.cbord.com/nn-prod/ND")

    # Click North Dining Hall
    wait.until(EC.element_to_be_clickable((By.LINK_TEXT, hall_name))).click()

    # Wait for and click the first meal menu
    wait.until(EC.presence_of_element_located((By.CLASS_NAME, "cbo_nn_menuLink")))

    # Setup today's date string
    today_str = "Tuesday, April 22, 2025"

    # Get meal link initially to find out how many meals given on a day
    meal_links = get_meal_links(driver, wait, today_str)

    # Loop through all meals
    for i in range(len(meal_links)):
        # Re-retrieve meal links on each iteration so they are not stale
        meal_links = get_meal_links(driver, wait, today_str)

        # Retrieve specific link for loop iteration
        link = meal_links[i]

        # Capture meal name now before clicking away
        meal_name = link.text

        # Click on meal link
        link.click()
        wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "cbo_nn_itemHover")))

        # Scrape all data
        scrape_all_labels(driver, wait, meal_name, hall_name, BASE_DIR)

        # Wait for the list‑page Back button by its unique ID
        back_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn_Back2")))

        # Scroll it into view just in case
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", back_btn)

        # Click the back button (JS fallback if normal click doesn’t work)
        try:
            back_btn.click()
        except:
            driver.execute_script("arguments[0].click();", back_btn)

        # Wait for menu cells to re‑appear
        wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "cbo_nn_menuCell")))

        # Scroll date header back into view
        date_td = driver.find_element(
            By.XPATH,
            f"//td[@class='cbo_nn_menuCell']//td[normalize-space(text())='{today_str}']"
        )
        driver.execute_script("arguments[0].scrollIntoView({ block: 'center' });", date_td)

    # Quit the selenium driver
    driver.quit()

if __name__ == "__main__":
    # Nuke all stale data once in main
    BASE_DIR = "all_nutrition_data"
    delete_old_dirs(BASE_DIR)

    # All halls on net nutrition website
    halls = [
        "Holy Cross College Dining Hall",
        "North Dining Hall",
        "Saint Mary's Dining Hall",
        "South Dining Hall",
    ]

    # Send base_dirs as parallelized argument
    # Can't have global var's in parallel and don't want to hardcode BASE_DIR in each function
    base_dirs = [BASE_DIR] * len(halls)

    # Run up to 4 scrapers in parallel:
    with ProcessPoolExecutor(max_workers=4) as exe:
        exe.map(scrape_hall, halls, base_dirs)
