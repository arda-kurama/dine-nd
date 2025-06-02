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

export type MenuItem = {
    name: string;
    serving_size: string;
    nutrition: {
        calories: number;
        calories_from_fat: number;
        total_fat: string;
        saturated_fat: string;
        cholesterol: string;
        sodium: string;
        potassium: string;
        total_carbohydrate: string;
        dietary_fiber: string;
        sugars: string;
        protein: string;
    };
    daily_values: {
        total_fat: string;
        saturated_fat: string;
        cholesterol: string;
        sodium: string;
        total_carbohydrate: string;
        protein: string;
    };
    ingredients: string;
    allergens: string;
    // In case your JSON ever has extra fields, we allow them here:
    [key: string]: any;
};

// This describes the entire `consolidated_menu.json` shape.
export type ConsolidatedMenu = {
    last_updated: string;
    date: string;
    dining_halls: {
        [hallId: string]: {
            [mealPeriod: string]: {
                available: boolean;
                categories: {
                    [categoryName: string]: MenuItem[];
                };
            };
        };
    };
};
