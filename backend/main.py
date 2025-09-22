"""
Command-line entry point for scraping, consolidating, and exporting DineND data.

Main responsibilities:
1. Discover available (hall, meal) pairs for the day.
2. Scrape meal data in parallel with retry logic.
3. Consolidate and serialize results to JSON.
4. Print a final scrape report to stdout.
"""

import json
import sys
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from .constants import DATE_STR
from .tasks import discover_all_meal_tasks
from .scraper import scrape_meal_with_retries
from .consolidate import consolidate_meal_data, create_lightweight_summary

def main() -> None:
    """
    Scrape all dining-hall meals in parallel for today's DATE_STR,
    consolidate results into `consolidated_menu.json` and a lightweight
    summary `menu_summary.json`, then print a summary to stdout.
    Exits with code 1 if no meals are found.
    """

    print(f"Starting main scraping for {DATE_STR}...")
    
    # Discover available meals
    discovered_tasks = discover_all_meal_tasks()

    # If no meals were discovered, write empty outputs and exit zero
    if not discovered_tasks:
        print("No meals to scrape for today, generating empty JSON outputs.")

        # Produce an “empty frame”: all halls, no meals
        empty_consolidated = consolidate_meal_data([])
        with open("consolidated_menu.json", "w", encoding="utf-8") as f:
            json.dump(empty_consolidated, f, indent=2, ensure_ascii=False)

        empty_summary = create_lightweight_summary(empty_consolidated)
        with open("menu_summary.json", "w", encoding="utf-8") as f:
            json.dump(empty_summary, f, indent=2)

        print("Wrote empty consolidated_menu.json and menu_summary.json")
        sys.exit(0)

    # Print the number of discovered tasks
    print(f"\nFound {len(discovered_tasks)} available meals to scrape.")

    # Parallelize the scrape with memory optimization
    print(f"Starting parallel scraping of {len(discovered_tasks)} meals...")

    # Limit concurrency to avoid resource exhaustion
    max_workers = min(4, os.cpu_count() or 1, len(discovered_tasks))

    meal_data_results = []
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        # Submit all scraping jobs to separate processes; each returns a MealData instance
        futures = [
            executor.submit(scrape_meal_with_retries, hall, meal)
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

    print(f"\nConsolidating {len(meal_data_results)} meal datasets.")
    
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
    print(f"SCRAPING COMPLETE!!!")
    print(f"{'='*70}")
    print(f"Successfully processed: {completed} meals.")
    if failed > 0:
        print(f"Failed: {failed} meals.")
    print(f"Full menu data: {output_file} (~{os.path.getsize(output_file) / 1024:.1f} KB)")
    print(f"Lightweight summary: {summary_file} (~{os.path.getsize(summary_file) / 1024:.1f} KB)")
    print("Ready for deployment!")

if __name__ == "__main__":
    main()