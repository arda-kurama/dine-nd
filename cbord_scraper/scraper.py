"""
Core scraping logic to extract nutrition info for a single meal.

Includes:
- scrape_meal: Full scrape logic for a single (hall, meal) using Selenium.
- scrape_meal_with_retries: Wraps scrape_meal with retry logic and exponential backoff.
"""

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from collections import defaultdict
from .constants import DATE_STR, URL, WAIT_TIMEOUT_SECS, MAX_RETRIES, MealData
from .parsers import parse_nutrition_html
from .tasks import create_chrome_driver
import time
import random

def scrape_meal_with_retries(hall: str, meal: str, backoff: float = 1.0) -> MealData:
    """
    Calls scrape_one_memory_optimized, retrying up to max_retries times
    if availability is False or an exception is raised.
    """
    
    last_result = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = scrape_meal(hall, meal)
            last_result = result
            # If succeeded or last attempt, return result
            if result.available or attempt == MAX_RETRIES:
                return result
            print(f"⚠️  Attempt {attempt} for {hall}-{meal} returned no data; retrying…")
        except Exception as e:
            print(f"⚠️  Attempt {attempt} for {hall}-{meal} threw {type(e).__name__}: {e}")
            last_result = MealData(hall=hall, meal=meal, available=False, categories={})
        # Backoff before retrying
        time.sleep(backoff * attempt * random.uniform(0.5, 1.5))
    return last_result

def scrape_meal(hall: str, meal: str) -> MealData:
    """
    Launch a headless Chrome session, navigate to the menu for `hall` on DATE_STR,
    click on the `meal` name. If the meal is not found, return:
      MealData(hall, meal, available=False, categories={}).
    Otherwise, iterate through each item row, open its nutrition label,
    parse it via parse_nutrition_html, group FoodItem entries by category,
    close the label, and finally quit the browser. Returns a MealData tuple.
    """
    
    driver = None
    try:        
        driver = create_chrome_driver()
        wait = WebDriverWait(driver, WAIT_TIMEOUT_SECS)

        # Go to the main URL
        driver.get(URL)

        # Select hall
        wait.until(EC.element_to_be_clickable((By.LINK_TEXT, hall))).click()
        wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "td.cbo_nn_menuCell")))

        # Try to find the meal link
        try:
            # XPath: find any cell whose text (normalized) contains today's date string
            date_cell = driver.find_element(
                By.XPATH,
                f"//td[@class='cbo_nn_menuCell'][contains(normalize-space(.), '{DATE_STR}')]"
            )
            meal_link = date_cell.find_element(By.LINK_TEXT, meal)
            meal_link.click()
        # Meal doesn't exist for this hall/date
        except NoSuchElementException:
            return MealData(hall=hall, meal=meal, available=False, categories={})


        # Grab the table of rows (group headers and item rows)
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "cbo_nn_itemGridTable")))
        table = driver.find_element(By.CLASS_NAME, "cbo_nn_itemGridTable")
        rows = table.find_elements(By.TAG_NAME, "tr")

        # Initialize variables for scraping
        current_group = None
        categories = defaultdict(list)
        items_scraped = 0

        # Iterate through each row in the table
        for row in rows:
            try:
                # Check if row is a group header
                group_cells = row.find_elements(By.CSS_SELECTOR, "td.cbo_nn_itemGroupRow")

                # If it is a group header, update current group
                if group_cells:
                    grp_name = group_cells[0].text.strip()
                    sanitized = grp_name.replace(' ', '_').replace('/', '_') or 'Ungrouped'
                    current_group = sanitized.replace('_', ' ').title()  # Clean name for display
                    continue

                # Otherwise check if it is an item row
                item_cells = row.find_elements(By.CSS_SELECTOR, "td.cbo_nn_itemHover")

                # If no item cells, skip to next row
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

            # If one item fails continue with next item instead of failing entire meal
            except Exception as e:
                continue

        print(f"✓ {hall} - {meal}: {items_scraped} items")
        return MealData(hall=hall, meal=meal, available=True, categories=dict(categories))

    # Handle specific Selenium exceptions
    except Exception as e:
        print(f"✗ {hall} - {meal}: Failed ({type(e).__name__})")
        return MealData(hall=hall, meal=meal, available=False, categories={})
    
    # Ensure driver is closed properly
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass