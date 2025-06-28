"""
Command-line entry point to scrape, consolidate, and summarize DineND menus.

Workflow:
1. Discover available hall/meal pairs.
2. Scrape each in parallel with memory optimization.
3. Write out consolidated_menu.json and menu_summary.json.
4. Print a completion report (counts, file sizes, errors).
Exits with code 1 if no meals are found.
"""

import json
import sys
import os
import time
import random
from concurrent.futures import ProcessPoolExecutor, as_completed
from .constants import DATE_STR, MAX_RETRIES, MealData
from .tasks import discover_tasks_resilient
from .scraper import scrape_one_memory_optimized
from .consolidate import consolidate_meal_data, create_lightweight_summary

def scrape_with_retry(hall: str, meal: str, backoff: float = 1.0) -> MealData:
    """
    Calls scrape_one_memory_optimized, retrying up to max_retries times
    if availability is False or an exception is raised.
    """
    last_result = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = scrape_one_memory_optimized(hall, meal)
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

def main() -> None:
    """
    Scrape all dining-hall meals in parallel for today's DATE_STR,
    consolidate results into `consolidated_menu.json` and a lightweight
    summary `menu_summary.json`, then print a summary to stdout.
    Exits with code 1 if no meals are found.
    """

    print(f"🚀 Starting memory-optimized scraping for {DATE_STR}...")
    
    # Discover available meals
    discovered_tasks = discover_tasks_resilient()

    # If no meals were discovered, write empty outputs and exit zero
    if not discovered_tasks:
        print("⚠️  No meals to scrape for today — generating empty JSON outputs.")

        # Produce an “empty frame”: all halls, no meals
        empty_consolidated = consolidate_meal_data([])
        with open("consolidated_menu.json", "w", encoding="utf-8") as f:
            json.dump(empty_consolidated, f, indent=2, ensure_ascii=False)

        empty_summary = create_lightweight_summary(empty_consolidated)
        with open("menu_summary.json", "w", encoding="utf-8") as f:
            json.dump(empty_summary, f, indent=2)

        print("✅ Wrote empty consolidated_menu.json and menu_summary.json")
        sys.exit(0)

    # Print the number of discovered tasks
    print(f"\n✓ Found {len(discovered_tasks)} available meals to scrape")

    # Parallelize the scrape with memory optimization
    print(f"🔄 Starting parallel scraping of {len(discovered_tasks)} meals...")

    # Limit concurrency to avoid resource exhaustion
    max_workers = min(4, os.cpu_count() or 1, len(discovered_tasks))

    meal_data_results = []
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        # Submit all scraping jobs to separate processes; each returns a MealData instance
        futures = [
            executor.submit(scrape_with_retry, hall, meal)
            for hall, meal in discovered_tasks
        ]

        # Collect results as they complete
        completed = 0
        failed = 0
        for future in as_completed(futures):
            try:
                result = future.result()
                meal_data_results.append(result)
                completed += 1
            # Handle scraping errors
            except Exception as e:
                failed += 1
                print(f"Unhandled task error: {e}")

    print(f"\n🔄 Consolidating {len(meal_data_results)} meal datasets...")
    
    # Consolidate all data in memory
    consolidated_data = consolidate_meal_data(meal_data_results)
    
    # Create and write main output
    output_file = "consolidated_menu.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(consolidated_data, f, indent=2, ensure_ascii=False)
    
    # Create and write lightweight summary
    lightweight_data = create_lightweight_summary(consolidated_data)
    summary_file = "menu_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(lightweight_data, f, indent=2)

    # Print final summary
    print(f"\n{'='*70}")
    print(f"🎉 MEMORY-OPTIMIZED SCRAPING COMPLETE")
    print(f"{'='*70}")
    print(f"✅ Successfully processed: {completed} meals")
    if failed > 0:
        print(f"✗ Failed: {failed} meals")
    print(f"📱 Full menu data: {output_file} (~{os.path.getsize(output_file) / 1024:.1f} KB)")
    print(f"⚡ Lightweight summary: {summary_file} (~{os.path.getsize(summary_file) / 1024:.1f} KB)")
    print("🚀 Ready for React Native deployment!")

if __name__ == "__main__":
    main()