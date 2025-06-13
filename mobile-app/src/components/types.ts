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
