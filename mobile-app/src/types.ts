// src/types.ts

/**
 * Represents a single menu item with all its details.
 */
export interface MenuItem {
    name: string;
    serving_size: string;
    nutrition: Record<string, number | string>;
    ingredients: string;
    allergens: string;
}

/**
 * A summary of available meals and categories per dining hall.
 */
export interface MenuSummary {
    dining_halls: Record<
        string,
        Record<
            string,
            {
                available: boolean;
                categories?: string[];
            }
        >
    >;
}

/**
 * Detailed menu structure including categories and items per meal per hall.
 */
export interface MenuDetail {
    dining_halls: Record<
        string,
        Record<
            string,
            {
                categories: Record<string, MenuItem[]>;
            }
        >
    >;
}
