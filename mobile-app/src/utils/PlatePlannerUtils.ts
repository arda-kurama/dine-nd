/**
 * Utility functions to support “Plate Planner,” now with ±10% tolerance.
 *   • parseNutrition: converts raw nutrition fields → numbers
 *   • generateVirtualItems: builds "1×, 2×, …" virtual servings of each item
 *   • findPlateCombinations: brute‐force search, accepting combos within ±10% of each target
 */

// 1) TYPE DEFINITIONS

/** The four macros we care about. */
export interface Nutrition {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

/**
 * A menu item as it comes from your consolidated JSON.
 * Renamed from “MenuItem” → “PlannerMenuItem” to avoid conflicts.
 */

import type { MenuItem } from "../types";
export type PlannerMenuItem = MenuItem & {
    id: string;
};

/**
 * A "virtual" item representing N servings of the same base item.
 */
export interface VirtualMenuItem {
    original: PlannerMenuItem;
    servings: number;
    nutrition: Nutrition;
    key: string; // e.g. `${original.id}__x${servings}`
}

// 2) SIMPLE NUTRITION HELPERS
/**
 * Peel off either raw values or `{ amount, daily_value }` objects → number.
 */
function parseAmount(value: any): number {
    if (value == null) return 0;
    // If it’s an object, unwrap `.amount`
    if (typeof value === "object") {
        return parseAmount((value as any).amount);
    }
    if (typeof value === "number") return value;

    // String case: maybe "7g", "< 1g", "0", etc.
    const str = value.toString();
    const match = str.match(/[\d.]+/);
    if (!match) return 0;
    const asNum = parseFloat(match[0]);

    // If the string contained "<", round it (e.g. "<1" → 1).
    if (str.includes("<")) return Math.round(asNum);

    return Math.round(asNum);
}

/**
 * Convert `plannerItem.nutrition` into a simple Nutrition object.
 */
export function parseNutrition(plannerItem: PlannerMenuItem): Nutrition {
    const nutrientKeys = Object.keys(plannerItem.nutrition || {});

    const lookup = (names: string[]): number => {
        for (const key of nutrientKeys) {
            const lower = key.toLowerCase();
            if (names.includes(lower)) {
                const entry = (plannerItem.nutrition as any)[key];
                // If it’s an object with `.amount`, unwrap it…
                if (
                    entry != null &&
                    typeof entry === "object" &&
                    "amount" in entry
                ) {
                    return parseAmount((entry as any).amount);
                }
                // …otherwise treat it as a raw number or string
                return parseAmount(entry);
            }
        }
        return 0;
    };

    const calories = lookup(["calories", "kcal", "energy"]);
    const protein = lookup(["protein", "prot", "proteins"]);
    const carbs = lookup([
        "carb",
        "carbs",
        "carbohydrate",
        "carbohydrates",
        "total_carbohydrate",
    ]);
    const fat = lookup(["fat", "fats", "total_fat"]);

    return { calories, protein, carbs, fat };
}

function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
    return {
        calories: a.calories + b.calories,
        protein: a.protein + b.protein,
        carbs: a.carbs + b.carbs,
        fat: a.fat + b.fat,
    };
}

/**
 * Given:
 *  - got: the summed nutrition so far
 *  - target: the user’s target macros (some fields undefined if the user left them blank)
 *  This returns `true` iff, for every field that is defined in `target`, we have
 *    |got[field] – target[field]| ≤ 0.10 × target[field].
 */
function matchesWithTolerance(
    got: Nutrition,
    target: Partial<Nutrition>
): boolean {
    if (target.calories !== undefined) {
        const tol = target.calories * 0.1;
        if (Math.abs(got.calories - target.calories) > tol) return false;
    }
    if (target.protein !== undefined) {
        const tol = target.protein * 0.1;
        if (Math.abs(got.protein - target.protein) > tol) return false;
    }
    if (target.carbs !== undefined) {
        const tol = target.carbs * 0.1;
        if (Math.abs(got.carbs - target.carbs) > tol) return false;
    }
    if (target.fat !== undefined) {
        const tol = target.fat * 0.1;
        if (Math.abs(got.fat - target.fat) > tol) return false;
    }
    return true;
}

/**
 * Given:
 *  - got: the summed nutrition so far
 *  - target: the user’s target macros (some fields undefined)
 * This returns `true` if on any defined field, `got[field] > target[field] × 1.1`.
 * In other words, it checks if we have already overshot the 10% upper bound on any macro.
 */
function overshootsUpperBound(
    got: Nutrition,
    target: Partial<Nutrition>
): boolean {
    if (target.calories !== undefined && got.calories > target.calories * 1.1) {
        return true;
    }
    if (target.protein !== undefined && got.protein > target.protein * 1.1) {
        return true;
    }
    if (target.carbs !== undefined && got.carbs > target.carbs * 1.1) {
        return true;
    }
    if (target.fat !== undefined && got.fat > target.fat * 1.1) {
        return true;
    }
    return false;
}

// 3) GENERATE “VIRTUAL” ITEMS FOR MULTIPLE SERVINGS

/**
 * Given a list of base items and a max number of servings,
 * produce all VirtualMenuItems for servings = 1..maxServings of each item.
 */
export function generateVirtualItems(
    plannerItems: PlannerMenuItem[],
    maxServings: number
): VirtualMenuItem[] {
    const virtualList: VirtualMenuItem[] = [];

    for (const item of plannerItems) {
        const baseNut = parseNutrition(item);

        // Skip items that contribute zero to all four macros:
        if (
            baseNut.calories === 0 &&
            baseNut.protein === 0 &&
            baseNut.carbs === 0 &&
            baseNut.fat === 0
        ) {
            continue;
        }

        const rawId = item.id ?? item.name;
        const safeId = rawId
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]/g, "_")
            .toLowerCase();

        for (let s = 1; s <= maxServings; s++) {
            virtualList.push({
                original: item,
                servings: s,
                nutrition: {
                    calories: baseNut.calories * s,
                    protein: baseNut.protein * s,
                    carbs: baseNut.carbs * s,
                    fat: baseNut.fat * s,
                },
                key: `${safeId}__x${s}`,
            });
        }
    }

    return virtualList;
}

// 4) FIND ALL COMBINATIONS THAT MATCH WITH ±10% TOLERANCE

/**
 * Brute‐force search for all combinations (size ≤ maxItems) of virtual items
 * whose summed Nutrition “matches” the target on each defined macro within ±10%.
 *
 * @param virtualItems  An array of VirtualMenuItem to choose from
 * @param target        A Partial<Nutrition> where undefined fields are “ignore”
 * @param maxItems      The maximum number of VirtualMenuItems in a combo
 */
export function findPlateCombinations(
    virtualItems: VirtualMenuItem[],
    target: Partial<Nutrition>,
    maxItems: number
): VirtualMenuItem[][] {
    const results: VirtualMenuItem[][] = [];
    const n = virtualItems.length;

    function backtrack(
        startIdx: number,
        currentCombo: VirtualMenuItem[],
        currentSum: Nutrition
    ) {
        // If too many items, stop:
        if (currentCombo.length > maxItems) {
            return;
        }

        // If currentSum already overshoots the 10% upper bound on any defined macro, prune:
        if (overshootsUpperBound(currentSum, target)) {
            return;
        }

        // If currentSum is within ±10% on all defined macros, record this combo:
        if (matchesWithTolerance(currentSum, target)) {
            results.push([...currentCombo]);
            // Note: do NOT return; there could be longer combos that also match
        }

        // If we've reached maxItems or reached the end of the list, stop:
        if (currentCombo.length === maxItems || startIdx === n) {
            return;
        }

        // Try adding each possible next item
        for (let i = startIdx; i < n; i++) {
            const nextItem = virtualItems[i];
            const nextSum = addNutrition(currentSum, nextItem.nutrition);

            // Prune if nextSum overshoots 10% upper bound on any defined macro
            if (overshootsUpperBound(nextSum, target)) {
                continue;
            }

            currentCombo.push(nextItem);
            backtrack(i + 1, currentCombo, nextSum);
            currentCombo.pop();
        }
    }

    // Start with an empty combination & zero nutrition
    backtrack(0, [], { calories: 0, protein: 0, carbs: 0, fat: 0 });
    return results;
}
