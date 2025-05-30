from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from collections import defaultdict
from .constants import DATE_STR, URL, MealData
from .parsers import parse_nutrition_html
from .tasks import make_chrome

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