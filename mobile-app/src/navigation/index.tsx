import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HallList from "../screens/HallList";
import DiningHallScreen from "../screens/DiningHallScreen";
// import PlatePlanner from "../screens/PlatePlanner";
import ItemDetail from "../screens/ItemDetail";

import type { MenuItem } from "../types";

// Define the navigation parameters for each screen
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: "#0C234B",
                    },
                    headerTintColor: "#FFFFFF",
                    headerTitleStyle: {
                        fontWeight: "700",
                    },
                    headerTitle: "DineND",
                    headerBackTitle: "Back",
                }}
                initialRouteName="Halls"
            >
                <Stack.Screen name="Halls" component={HallList} />
                <Stack.Screen name="DiningHall" component={DiningHallScreen} />
                {/* <Stack.Screen name="PlatePlanner" component={PlatePlanner} /> */}
                <Stack.Screen name="ItemDetail" component={ItemDetail} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
