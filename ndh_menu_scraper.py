from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
from datetime import datetime
import shutil

# Get all of the meal links for a given date
def get_meal_links(driver, wait, date_str):
    # Wait for the date cells to appear
    wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "cbo_nn_menuCell")))
    
    # Locate the <td> in the HTML that equals the date string
    date_td = driver.find_element(
        By.XPATH,
        f"//td[@class='cbo_nn_menuCell']//td[normalize-space(text())='{date_str}']"
    )

    # From there, go up to its <tr>, then to the next <tr>, 
    # Then pull out all the <a class="cbo_nn_menuLink"> inside it
    meal_links = date_td.find_elements(
        By.XPATH,
        "../following-sibling::tr[1]//a[contains(@class,'cbo_nn_menuLink')]"
    )

    # Return list of links
    return meal_links

# Scrape all nutrition data for a given meal
def scrape_all_labels(driver, wait, meal_name):
    # Format the meal name
    meal_name = meal_name.strip().replace(" ", "_")

    # Setup output directory for nutrition labels
    OUTPUT_DIR = f"NDH_{meal_name}"

    # Delete any old files/folders ───
    if os.path.exists(OUTPUT_DIR):
        # Remove the entire directory tree and its contents
        shutil.rmtree(OUTPUT_DIR)
    # Then recreate it empty
    os.makedirs(OUTPUT_DIR)

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

# SELENIUM SETUP
chrome_options = Options()
# chrome_options.add_argument("--headless")                  # run in background
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
wait.until(EC.element_to_be_clickable((By.LINK_TEXT, "North Dining Hall"))).click()

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
    scrape_all_labels(driver, wait, meal_name)

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
