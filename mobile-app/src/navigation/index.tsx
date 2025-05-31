import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
    createNativeStackNavigator,
    NativeStackNavigationProp,
} from "@react-navigation/native-stack";

import HallList from "../screens/HallList";
import MealPeriods from "../screens/MealPeriods";
import CategoryList from "../screens/CategoryList";
import ItemList from "../screens/ItemList";
import ItemDetail from "../screens/ItemDetail";
// …import your CategoryList, ItemList, etc…

import type { MenuItem } from "../types";

// 1️⃣ Export this type so your screens can import it
export type RootStackParamList = {
    Halls: undefined;
    Meals: { hall: string };
    Categories: { hall: string; meal: string };
    Items: { hall: string; meal: string; category: string };
    ItemDetail: { item: MenuItem };
};

// 2️⃣ Use createNativeStackNavigator instead of createStackNavigator
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Halls">
                <Stack.Screen name="Halls" component={HallList} />
                <Stack.Screen name="Meals" component={MealPeriods} />
                <Stack.Screen name="Categories" component={CategoryList} />
                <Stack.Screen name="Items" component={ItemList} />
                <Stack.Screen
                    name="ItemDetail"
                    component={ItemDetail}
                    options={{ title: "Nutrition Facts" }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
