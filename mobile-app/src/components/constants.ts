import { Dimensions } from "react-native";
import sectionDefs from "./section_defs.json";

export const GITHUB_PAGES_BASE = "https://arda-kurama.github.io/dine-nd";
export const SUMMARY_URL = `${GITHUB_PAGES_BASE}/menu_summary.json`;
export const CONSOLIDATED_URL = `${GITHUB_PAGES_BASE}/consolidated_menu.json`;
export const DEFAULT_IMAGE = { uri: "" };
export const { width, height } = Dimensions.get("window");
export const CARD_HEIGHT = height * 0.125;

// Map dining halls to their associated images
export const hallImages: Record<string, { uri: string }> = {
    "Holy Cross College Dining Hall": {
        uri: "https://dining.nd.edu/stylesheets/images/hcc_dining_room.jpg",
    },
    "North Dining Hall": {
        uri: "https://dining.nd.edu/stylesheets/images/feature_NDH800.jpg",
    },
    "Saint Mary's Dining Hall": {
        uri: "https://dining.nd.edu/stylesheets/images/saint-marys-dining.jpg",
    },
    "South Dining Hall": {
        uri: "https://dining.nd.edu/stylesheets/images/feature_SDH800.jpg",
    },
};

// Group categories into sections by matching names using regexes
export const SECTION_DEFINITIONS = sectionDefs.map(({ title, pattern }) => ({
    title,
    match: (n: string) => new RegExp(pattern).test(n),
}));

export const ALLERGENS = [
    "Eggs",
    "Fish",
    "Milk",
    "Peanuts",
    "Pork",
    "Sesame Seed",
    "Shellfish",
    "Soy",
    "Tree Nuts",
    "Wheat",
];

export const MEAL_ORDER = [
    "Breakfast",
    "Continental",
    "Brunch",
    "Lunch",
    "Late Lunch",
    "Dinner",
];
