import json

with open("ndh_nutrition_data.json") as f:
    data = json.load(f)

print("Total labels parsed:", len(data))
