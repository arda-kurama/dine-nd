import json
import sys
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from .constants import DATE_STR
from .tasks import discover_tasks_resilient
from .scraper import scrape_one_memory_optimized
from .consolidate import consolidate_meal_data, create_lightweight_summary

def main():
    print(f"🚀 Starting memory-optimized scraping for {DATE_STR}...")
    
    # Discover available meals
    discovered_tasks = discover_tasks_resilient()
    
    if not discovered_tasks:
        print("No meals to scrape - exiting")
        sys.exit(1)

    print(f"\n✓ Found {len(discovered_tasks)} available meals to scrape")

    print(f"🔄 Starting parallel scraping of {len(discovered_tasks)} meals...")
    
    # Parallelize the scrape with memory optimization
    meal_data_results = []
    
    with ProcessPoolExecutor(max_workers=min(os.cpu_count(), len(discovered_tasks))) as executor:
        # Submit all scraping jobs
        futures = [
            executor.submit(scrape_one_memory_optimized, hall, meal)
            for hall, meal in discovered_tasks
        ]
        
        completed = 0
        failed = 0
        for future in as_completed(futures):
            try:
                result = future.result()
                meal_data_results.append(result)
                completed += 1
            except Exception as e:
                failed += 1
                print(f"Unhandled task error: {e}")

    print(f"\n🔄 Consolidating {len(meal_data_results)} meal datasets...")
    
    # Consolidate all data in memory
    consolidated_data = consolidate_meal_data(meal_data_results)
    
    # Write final outputs
    output_file = "consolidated_menu.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(consolidated_data, f, indent=2, ensure_ascii=False)
    
    # Create and write lightweight summary
    lightweight_data = create_lightweight_summary(consolidated_data)
    summary_file = "menu_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(lightweight_data, f, indent=2)

    print(f"\n{'='*70}")
    print(f"🎉 MEMORY-OPTIMIZED SCRAPING COMPLETE")
    print(f"{'='*70}")
    print(f"✅ Successfully processed: {completed} meals")
    if failed > 0:
        print(f"✗ Failed: {failed} meals")
    print(f"📊 Summary: {consolidated_data['summary']}")
    print(f"📱 Full menu data: {output_file} (~{os.path.getsize(output_file) / 1024:.1f} KB)")
    print(f"⚡ Lightweight summary: {summary_file} (~{os.path.getsize(summary_file) / 1024:.1f} KB)")
    print("🚀 Ready for React Native deployment!")

if __name__ == "__main__":
    main()