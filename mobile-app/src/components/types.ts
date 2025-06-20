// Expected type for menu_summary.json
export interface MenuSummary {
    last_updated: string;
    date: string;
    dining_halls: Record<string, number>;
}

// Expected type for item in consolidated_menu.json
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
    [key: string]: any;
};

// Special type used in DiningHallScreen.tsx
export type PlateItem = MenuItem & { servings: number };

// Expected type of entire consolidated_menu.json
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

// Expected parameters for all screens
export type RootStackParamList = {
    Halls: { customBack?: boolean };
    DiningHall: {
        hallId: string;
        hallName: string;
    };
    PlatePlanner: {
        hallId: string;
        hallName: string;
        mealPeriod: string;
    };
    ItemDetail: {
        hallId: string;
        mealPeriod: string;
        categoryId: string;
        itemDetail: MenuItem;
    };
    Info: undefined;
};

// Epected type of master hall schedule
export type MealWindow = { start: number; end: number }; // 24h decimal
export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type HallSchedule = {
    [day in Day]?: {
        [meal: string]: MealWindow;
    };
};
