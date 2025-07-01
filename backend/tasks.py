"""
Browser setup and task discovery for DineND scraping.

Contains:
- make_chrome: Configure and return a headless Selenium Chrome WebDriver.
- get_meal_links_for_hall: Fetch available meal names for a hall on DATE_STR.
- discover_tasks_resilient: Iterate over all halls to build the full list of
  (hall, meal) scraping tasks.
"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, WebDriverException, TimeoutException
from typing import List, Tuple
from .constants import HALLS, DATE_STR, URL, WAIT_TIMEOUT_SECS, PAGE_LOAD_TIMEOUT_SECS, MAX_RETRIES
import time

def create_chrome_driver() -> webdriver.Chrome:
    """
    Return a headless Chrome WebDriver configured with:
      --headless, --disable-gpu, --no-sandbox, --disable-extensions, plus
      extra flags to disable background throttling. Uses /usr/bin/chromedriver.
    """

    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--blink-settings=imagesEnabled=false")
    opts.add_argument("--disable-background-timer-throttling")
    opts.add_argument("--disable-backgrounding-occluded-windows")
    opts.add_argument("--disable-renderer-backgrounding")
    
    service = Service("/usr/bin/chromedriver")
    driver = webdriver.Chrome(service=service, options=opts)
    driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT_SECS)
    return driver

def fetch_meal_links(hall: str) -> List[Tuple[str, str]]:
    """
    For a single `hall`, launch a headless Chrome session, navigate to the main URL,
    click on the hall name, wait for today’s date cell (DATE_STR). If no date cell
    exists, return an empty list. Otherwise, gather all meal names inside that cell
    and return a list of tuples [(hall, meal_name), …]. Closes the browser on exit.
    """

    driver = None
    try:
        driver = create_chrome_driver()
        wait = WebDriverWait(driver, WAIT_TIMEOUT_SECS)
        
        print(f"Checking {hall}...")

        # Go to the main URL
        driver.get(URL)
        
        # Click the hall link
        wait.until(EC.element_to_be_clickable((By.LINK_TEXT, hall))).click()
        
        # Wait for the meal-list table to load
        wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "cbo_nn_menuCell")))
        
        # Try to find the specific date cell for today
        try:
            cell = driver.find_element(
                By.XPATH,
                f"//td[@class='cbo_nn_menuCell'][contains(normalize-space(.), '{DATE_STR}')]"
            )
        
        # If no cell found, no menu for today
        except NoSuchElementException:
            print(f"  No menu available for {DATE_STR}")
            return []
        
        # Grab all meal links from the cell
        links = cell.find_elements(By.CSS_SELECTOR, "a.cbo_nn_menuLink")

        # If no links found, no meals for today
        if not links:
            print(f"  No meals found for {DATE_STR}")
            return []

        # Extract meal names from links 
        meals = [a.text.strip() for a in links]
        print(f"  ✓ Found {len(meals)} meals: {', '.join(meals)}")
        return [(hall, meal) for meal in meals]

    # Handle specific Selenium exceptions 
    except TimeoutException:
        print(f"  Timeout loading {hall}")
        return []
    except WebDriverException as e:
        print(f"  Browser connection failed")
        return []
    except Exception as e:
        print(f"  Unexpected error: {type(e).__name__}")
        return []

    # Ensure driver is closed properly
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

def fetch_meal_links_with_retries(hall: str) -> List[Tuple[str, str]]:
    """
    Calls the original get_meal_links_for_hall up to MAX_RETRIES times
    on TimeoutException, sleeping 1s between attempts.
    Returns [] after the final failure.
    """
    for attempt in range(1, MAX_RETRIES+1):
        links = fetch_meal_links(hall)
        if links or attempt == MAX_RETRIES:
            return links
        print(f"⚠️ No links (attempt {attempt}/{MAX_RETRIES}), retrying…")
        time.sleep(1)
    return []

def discover_all_meal_tasks() -> List[Tuple[str, str]]:
    """
    Iterate over all halls in HALLS, call get_meal_links_for_hall(hall) for each,
    and accumulate all (hall, meal) tuples into one list. Returns [] if none found.
    """

    all_tasks = []
    for hall in HALLS:
        hall_tasks = fetch_meal_links_with_retries(hall)
        all_tasks.extend(hall_tasks)
    
    return all_tasks
