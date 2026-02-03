"""
Task discovery and browser setup for DineND scraping.

Includes:
- create_chrome_driver: Launches a headless Chrome driver with strict config.
- fetch_meal_links: Pulls available meals for a specific hall on DATE_STR.
- fetch_meal_links_with_retries: Retry wrapper for fetch_meal_links.
- discover_all_meal_tasks: Returns all (hall, meal) tasks for the current day.
"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, WebDriverException, TimeoutException
from typing import List, Tuple, Optional, Set
from .constants import HALLS, DATE_STR, URL, WAIT_TIMEOUT_SECS, PAGE_LOAD_TIMEOUT_SECS, MAX_RETRIES
import time
import os


def create_chrome_driver() -> webdriver.Chrome:
    """
    Create and return a headless Chrome WebDriver preconfigured with performance-safe options:
    - Disables GPU, extensions, throttling, and background rendering.
    - Loads /usr/bin/chromedriver with a timeout of PAGE_LOAD_TIMEOUT_SECS.
    """

    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--blink-settings=imagesEnabled=false")
    opts.add_argument("--disable-background-timer-throttling")
    opts.add_argument("--disable-backgrounding-occluded-windows")
    opts.add_argument("--disable-renderer-backgrounding")

    chrome_bin = os.environ.get(
        "CHROME_PATH",
        "/opt/hostedtoolcache/setup-chrome/chrome/stable/x64/chrome",
    )
    opts.binary_location = chrome_bin

    chromedriver_bin = os.environ.get(
        "CHROMEDRIVER_PATH",
        "/opt/hostedtoolcache/setup-chrome/chromedriver/stable/x64/chromedriver",
    )
    service = Service(chromedriver_bin)

    driver = webdriver.Chrome(service=service, options=opts)
    driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT_SECS)
    return driver


def fetch_meal_links(hall: str) -> List[Tuple[str, str]]:
    """
    Scrape available meal names for a single `hall` on DATE_STR.

    Returns a list of (hall, meal) pairs if meals are found, otherwise an empty list.
    Handles browser navigation, waits, and element detection using Selenium.
    """

    driver = None
    try:
        driver = create_chrome_driver()
        wait = WebDriverWait(driver, WAIT_TIMEOUT_SECS)
        print(f"Checking {hall}...")

        driver.get(URL)

        wait.until(EC.element_to_be_clickable((By.LINK_TEXT, hall))).click()
        wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "cbo_nn_menuCell")))

        try:
            cell = driver.find_element(
                By.XPATH,
                f"//td[@class='cbo_nn_menuCell'][contains(normalize-space(.), '{DATE_STR}')]"
            )
        except NoSuchElementException:
            print(f"  No menu available for {DATE_STR}")
            return []

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
    except WebDriverException:
        print("  Browser connection failed")
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


def fetch_meal_links_with_retries(hall: str) -> List[Tuple[str, str]]:
    """
    Retry wrapper for fetch_meal_links.

    Attempts up to MAX_RETRIES times with 1-second sleep between attempts.
    Returns meal links from the first successful scrape or an empty list after all retries.
    """

    for attempt in range(1, MAX_RETRIES + 1):
        links = fetch_meal_links(hall)
        if links or attempt == MAX_RETRIES:
            return links
        print(f"⚠️ No links (attempt {attempt}/{MAX_RETRIES}), retrying…")
        time.sleep(1)
    return []


def discover_all_meal_tasks(exclude_halls: Optional[Set[str]] = None) -> List[Tuple[str, str]]:
    """
    Build and return a complete list of (hall, meal) scraping tasks for DATE_STR.

    Iterates over all halls in HALLS (minus any excluded halls) and aggregates discovered meals.
    """

    exclude_halls = exclude_halls or set()

    all_tasks = []
    for hall in HALLS:
        if hall in exclude_halls:
            continue
        hall_tasks = fetch_meal_links_with_retries(hall)
        all_tasks.extend(hall_tasks)

    return all_tasks
