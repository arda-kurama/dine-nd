export interface MenuSummary {
    last_updated: string;
    date: string;
    dining_halls: Record<string, number>;
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
    [key: string]: any;
};

export type PlateItem = MenuItem & { servings: number };

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

export type RootStackParamList = {
    Halls: undefined;
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
};

export type MealWindow = { start: number; end: number }; // 24h decimal
export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type HallSchedule = {
    [day in Day]?: {
        [meal: string]: MealWindow;
    };
};
