from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from collections import defaultdict
from .constants import DATE_STR, URL, WAIT_TIMEOUT_SECS, MealData
from .parsers import parse_nutrition_html
from .tasks import make_chrome

def scrape_one_memory_optimized(hall: str, meal: str) -> MealData:
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
        driver = make_chrome()
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