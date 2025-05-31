// src/screens/MealPeriods.tsx
import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import summary from "../../assets/data/menu_summary.json";
import type { MenuSummary } from "../types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

type NavProp = NativeStackNavigationProp<RootStackParamList, "Meals">;

export default function MealPeriods({
    navigation,
    route,
}: {
    navigation: NavProp;
    route: { params: { hall: string } };
}) {
    const { hall } = route.params;
    const data = summary as MenuSummary;
    const mealsObj = data.dining_halls[hall] || {};
    const meals = Object.entries(mealsObj)
        .filter(([, info]) => info.available)
        .map(([meal]) => meal);

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 22, marginBottom: 12 }}>{hall}</Text>
            <FlatList
                data={meals}
                keyExtractor={(m) => m}
                renderItem={({ item: meal }) => (
                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate("Categories", { hall, meal })
                        }
                    >
                        <Text style={{ fontSize: 18, paddingVertical: 8 }}>
                            {meal}
                        </Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}
