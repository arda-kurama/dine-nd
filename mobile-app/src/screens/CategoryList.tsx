// src/screens/CategoryList.tsx
import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import summary from "../../assets/data/menu_summary.json";
import type { MenuSummary } from "../types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

type NavProp = NativeStackNavigationProp<RootStackParamList, "Categories">;

export default function CategoryList({
    navigation,
    route,
}: {
    navigation: NavProp;
    route: { params: { hall: string; meal: string } };
}) {
    const { hall, meal } = route.params;
    const data = summary as MenuSummary;
    const categories = data.dining_halls[hall][meal].categories || [];

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 22, marginBottom: 12 }}>
                {hall} – {meal}
            </Text>
            <FlatList
                data={categories}
                keyExtractor={(c) => c}
                renderItem={({ item: category }) => (
                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate("Items", {
                                hall,
                                meal,
                                category,
                            })
                        }
                    >
                        <Text style={{ fontSize: 18, paddingVertical: 8 }}>
                            {category}
                        </Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}
