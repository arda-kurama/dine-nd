#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime
from typing import Any, Dict


PREFER_NUTRISLICE_HALLS = {"North Dining Hall", "South Dining Hall"}


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def merge_consolidated(cbord: Dict[str, Any], nutri: Dict[str, Any]) -> Dict[str, Any]:
    cb_dh = cbord.get("dining_halls", {}) if isinstance(cbord.get("dining_halls"), dict) else {}
    nu_dh = nutri.get("dining_halls", {}) if isinstance(nutri.get("dining_halls"), dict) else {}

    merged: Dict[str, Any] = {
        "last_updated": datetime.now().isoformat(),
        "date": nutri.get("date") or cbord.get("date") or "",
        "dining_halls": {},
    }

    all_halls = set(cb_dh.keys()) | set(nu_dh.keys())
    for hall in sorted(all_halls):
        cb_meals = cb_dh.get(hall, {})
        nu_meals = nu_dh.get(hall, {})

        if not isinstance(cb_meals, dict):
            cb_meals = {}
        if not isinstance(nu_meals, dict):
            nu_meals = {}

        # Start with CBORD, then overlay Nutrislice where available.
        merged_meals = dict(cb_meals)
        merged_meals.update(nu_meals)

        # Explicit preference: Nutrislice should win for NDH/SDH if both exist.
        if hall in PREFER_NUTRISLICE_HALLS:
            merged_meals = dict(cb_meals)
            merged_meals.update(nu_meals)

        merged["dining_halls"][hall] = merged_meals

    return merged


def make_summary(consolidated: Dict[str, Any]) -> Dict[str, Any]:
    dh = consolidated.get("dining_halls", {})
    if not isinstance(dh, dict):
        dh = {}

    return {
        "last_updated": consolidated.get("last_updated", ""),
        "date": consolidated.get("date", ""),
        "dining_halls": {
            hall: (len(meals) if isinstance(meals, dict) else 0)
            for hall, meals in dh.items()
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Merge CBORD + Nutrislice consolidated_menu.json into one.")
    ap.add_argument("--cbord", required=True, help="Path to CBORD consolidated_menu.json")
    ap.add_argument("--nutri", required=True, help="Path to Nutrislice consolidated_menu.json")
    ap.add_argument("--out-consolidated", required=True, help="Output path for merged consolidated_menu.json")
    ap.add_argument("--out-summary", required=True, help="Output path for merged menu_summary.json")
    args = ap.parse_args()

    cb = load_json(args.cbord)
    nu = load_json(args.nutri)

    merged = merge_consolidated(cb, nu)
    summary = make_summary(merged)

    with open(args.out_consolidated, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    with open(args.out_summary, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    counts = summary["dining_halls"]
    total_meals = sum(counts.values())
    print(f"Merged halls: {counts}")
    print(f"Total meals: {total_meals}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
