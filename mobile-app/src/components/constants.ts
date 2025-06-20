import { Dimensions } from "react-native";
import sectionDefs from "./section_defs.json";
import { HallSchedule, MealWindow } from "./types";

// Base URL for GitHub Pages hosting menu data
export const GITHUB_PAGES_BASE = "https://arda-kurama.github.io/dine-nd";

// URL to the summarized menu JSON
export const SUMMARY_URL = `${GITHUB_PAGES_BASE}/menu_summary.json`;

// URL to the consolidated full menu JSON
export const CONSOLIDATED_URL = `${GITHUB_PAGES_BASE}/consolidated_menu.json`;

// Default image placeholder URI
export const DEFAULT_IMAGE = { uri: "" };

// Get device width and height for responsive layout
export const { width, height } = Dimensions.get("window");

// Define height of meal cards as a percentage of screen height
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

// Canonical category definitions with matching rules for backend/frontend consistency
export const SECTION_DEFINITIONS = sectionDefs.map(({ title, pattern }) => ({
    title,
    match: (n: string) => new RegExp(pattern).test(n),
}));

// Hardedcoded list of allergens
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

// Hardcoded master meal order
export const MEAL_ORDER = [
    "Breakfast",
    "Continental",
    "Brunch",
    "Lunch",
    "Late Lunch",
    "Dinner",
];

// Shared schedules
const southNorthWeekday: Record<string, MealWindow> = {
    Breakfast: { start: 7, end: 11 },
    Lunch: { start: 11, end: 14 },
    "Late Lunch": { start: 14, end: 16.5 },
    Dinner: { start: 16.5, end: 21 },
};

const southNorthFriday: Record<string, MealWindow> = {
    Breakfast: { start: 7, end: 11 },
    Lunch: { start: 11, end: 14 },
    "Late Lunch": { start: 14, end: 16.5 },
    Dinner: { start: 16.5, end: 20 },
};

const southNorthWeekend: Record<string, MealWindow> = {
    Brunch: { start: 9, end: 14 },
    Dinner: { start: 16.5, end: 20 },
};

const saintMarysWeekday: Record<string, MealWindow> = {
    Breakfast: { start: 7, end: 10 },
    Lunch: { start: 11, end: 14 },
    Dinner: { start: 16.5, end: 20 },
};

const saintMarysFriday: Record<string, MealWindow> = {
    Breakfast: { start: 7, end: 10 },
    Lunch: { start: 11, end: 14 },
    Dinner: { start: 16.5, end: 19 },
};

const saintMarysWeekend: Record<string, MealWindow> = {
    Continental: { start: 9, end: 10 },
    Brunch: { start: 10.5, end: 13.5 },
    Dinner: { start: 16.5, end: 19 },
};

const holyCrossWeekday: Record<string, MealWindow> = {
    Breakfast: { start: 7.5, end: 9.5 },
    Continental: { start: 9.5, end: 11 },
    Lunch: { start: 11, end: 14 },
    Dinner: { start: 16.75, end: 19.5 },
};

const holyCrossFriday: Record<string, MealWindow> = {
    Breakfast: { start: 7.5, end: 9.5 },
    Continental: { start: 9.5, end: 11 },
    Lunch: { start: 11, end: 14 },
    Dinner: { start: 16.75, end: 19 },
};

const holyCrossSat: Record<string, MealWindow> = {
    Brunch: { start: 11.5, end: 13 },
    Dinner: { start: 16.75, end: 19 },
};

const holyCrossSun: Record<string, MealWindow> = {
    Brunch: { start: 11.5, end: 13 },
    Dinner: { start: 16.75, end: 19.5 },
};

// Master schedule for all dining halls
export const HALL_SCHEDULES: Record<string, HallSchedule> = {
    "South Dining Hall": {
        Mon: southNorthWeekday,
        Tue: southNorthWeekday,
        Wed: southNorthWeekday,
        Thu: southNorthWeekday,
        Fri: southNorthFriday,
        Sat: southNorthWeekend,
        Sun: southNorthWeekend,
    },
    "North Dining Hall": {
        Mon: southNorthWeekday,
        Tue: southNorthWeekday,
        Wed: southNorthWeekday,
        Thu: southNorthWeekday,
        Fri: southNorthFriday,
        Sat: southNorthWeekend,
        Sun: southNorthWeekend,
    },
    "Saint Marys Dining Hall": {
        Mon: saintMarysWeekday,
        Tue: saintMarysWeekday,
        Wed: saintMarysWeekday,
        Thu: saintMarysWeekday,
        Fri: saintMarysFriday,
        Sat: saintMarysWeekend,
        Sun: saintMarysWeekend,
    },
    "Holy Cross Dining Hall": {
        Mon: holyCrossWeekday,
        Tue: holyCrossWeekday,
        Wed: holyCrossWeekday,
        Thu: holyCrossWeekday,
        Fri: holyCrossFriday,
        Sat: holyCrossSat,
        Sun: holyCrossSun,
    },
};

// Expected type for a response item from the plate planner API
export interface ApiItem {
    category: string;
    name: string;
    servings: number;
    servingSize: string;
}

// Expected type for the full response from the plate planner API
export interface ApiResponse {
    items: ApiItem[];
    totals: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
}
