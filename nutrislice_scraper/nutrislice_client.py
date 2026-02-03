from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, Optional
import requests

from .constants import NUTRISLICE_BASE


@dataclass(frozen=True)
class NutrisliceRef:
    school_slug: str
    menu_type_slug: str
    day: date


def weeks_url(ref: NutrisliceRef) -> str:
    return (
        f"{NUTRISLICE_BASE}/menu/api/weeks/school/{ref.school_slug}/menu-type/{ref.menu_type_slug}/"
        f"{ref.day.year}/{ref.day.month:02d}/{ref.day.day:02d}/?format=json"
    )


def fetch_week(ref: NutrisliceRef, timeout: float = 12.0) -> Optional[Dict[str, Any]]:
    try:
        r = requests.get(
            weeks_url(ref),
            timeout=timeout,
            headers={"User-Agent": "DineND/1.0"},
        )
        if r.status_code != 200:
            return None
        return r.json()
    except Exception:
        return None


def extract_day(week_json: Dict[str, Any], iso_date: str) -> Optional[Dict[str, Any]]:
    days = week_json.get("days")
    if not isinstance(days, list):
        return None
    for d in days:
        if isinstance(d, dict) and d.get("date") == iso_date:
            return d
    return None
