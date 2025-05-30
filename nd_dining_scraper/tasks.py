from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, WebDriverException, TimeoutException
from .constants import HALLS, EXPECTED_MEALS, DATE_STR, URL
from itertools import product

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
