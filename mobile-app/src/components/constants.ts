import { Dimensions } from "react-native";
import defs from "../../../section_defs.json";

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

export const SECTION_DEFINITIONS = defs.map(({ title, pattern }) => ({
    title,
    match: (n: string) => new RegExp(pattern).test(n),
}));

// export const SECTION_DEFINITIONS: {
//     title: string;
//     match: (n: string) => boolean;
// }[] = [
//     {
//         title: "Homestyle",
//         match: (n) => /Homestyle|Breakfast|Bistro/.test(n),
//     },
//     { title: "Mexican", match: (n) => /^Mexican/.test(n) },
//     { title: "Asian", match: (n) => /^Asian/.test(n) },
//     { title: "Grill", match: (n) => /^Grill/.test(n) },
//     {
//         title: "Quesadilla",
//         match: (n) => /^Quesadilla|Southwest Rice Bowl/.test(n),
//     },
//     {
//         title: "Toasting Station",
//         match: (n) => /^Toasting Station|^Bread/.test(n),
//     },
//     {
//         title: "Waffle Bar",
//         match: (n) => /^Waffle And Pancake/.test(n),
//     },
//     { title: "Oatmeal", match: (n) => /Oatmeal/.test(n) },
//     { title: "Myo Omlette", match: (n) => /^Myo Omelette/.test(n) },
//     { title: "Protein Bar", match: (n) => /Protein Bar/.test(n) },
//     { title: "Pizza", match: (n) => /Pizzaria|^Myo Pizza/.test(n) },
//     { title: "Pasta", match: (n) => /^Pasta/.test(n) },
//     { title: "Deli", match: (n) => /^Deli/.test(n) },
//     { title: "Salad", match: (n) => /^Salad Bar|.*Salad$/.test(n) },
//     { title: "Vegan", match: (n) => /^Vegan/.test(n) },
//     { title: "Soup", match: (n) => /Soup/.test(n) },
//     { title: "Fresh Fruit", match: (n) => /Fresh Fruit|Fruit/.test(n) },
//     { title: "Yogurt & Cereal", match: (n) => /Yogurt|Cereal/.test(n) },
//     {
//         title: "Dessert",
//         match: (n) => /^Dessert|Soft Serve|Toppings|Pastries/.test(n),
//     },
//     {
//         title: "Drinks",
//         match: (n) =>
//             /Fountain Drinks|Juice|Milk|Coffee & Tea|Beverage/.test(n),
//     },
// ];

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
