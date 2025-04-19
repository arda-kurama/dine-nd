from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os

# --- Optimize Chrome ---
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
driver.find_elements(By.CLASS_NAME, "cbo_nn_menuLink")[0].click()

# Wait for items to load
wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "cbo_nn_itemHover")))

# Write menu page to html
with open("ndh-menu.html", "w") as f:
    f.write(driver.page_source)

# Grab all food item names
food_items = [
    el.get_attribute("innerText").strip()
    for el in driver.find_elements(By.CLASS_NAME, "cbo_nn_itemHover")
]

# Setup output directory for nutrition labels
OUTPUT_DIR = "ndh_nutrition_labels"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Get all items on page
all_items = driver.find_elements(By.CLASS_NAME, "cbo_nn_itemHover")

# Loop through all items
for idx, item in enumerate(all_items):
    # Scroll item into view so click() actually hits
    driver.execute_script(f"arguments[0].scrollIntoView(true);", item)

    # Click it
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

# Quit the driver
driver.quit()
