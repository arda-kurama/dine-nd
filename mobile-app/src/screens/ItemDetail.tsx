// src/screens/ItemDetail.tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation";

type NavProp = NativeStackNavigationProp<RootStackParamList, "ItemDetail">;
type RouteProps = RouteProp<RootStackParamList, "ItemDetail">;

export default function ItemDetail({
    navigation,
    route,
}: {
    navigation: NavProp;
    route: RouteProps;
}) {
    const { item } = route.params;

    // Convert nutrition object ({ calories: 200, fat: 5, ... }) into an array
    const nutritionEntries = Object.entries(item.nutrition) as [
        string,
        number | string
    ][];

    return (
        <ScrollView style={styles.container}>
            {/* 1. Item name */}
            <Text style={styles.title}>{item.name}</Text>

            {/* 2. Serving size */}
            <Text style={styles.subHeader}>
                Serving Size: {item.serving_size}
            </Text>

            {/* 3. Nutrition Facts */}
            <Text style={styles.sectionHeader}>Nutrition Facts</Text>
            <View style={styles.nutritionContainer}>
                {nutritionEntries.map(([key, value]) => (
                    <View key={key} style={styles.nutritionRow}>
                        <Text style={styles.nutrientName}>
                            {capitalize(key)}
                        </Text>
                        <Text style={styles.nutrientValue}>{value}</Text>
                    </View>
                ))}
            </View>

            {/* 4. Ingredients */}
            <Text style={styles.sectionHeader}>Ingredients</Text>
            <Text style={styles.bodyText}>{item.ingredients || "N/A"}</Text>

            {/* 5. Allergens */}
            <Text style={styles.sectionHeader}>Allergens</Text>
            <Text style={styles.bodyText}>
                {item.allergens || "None listed"}
            </Text>
        </ScrollView>
    );
}

// Helper to capitalize nutrient keys (e.g. "calories" → "Calories")
function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
    subHeader: {
        fontSize: 16,
        fontWeight: "500",
        marginBottom: 16,
        color: "#333",
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: "600",
        marginTop: 16,
        marginBottom: 8,
    },
    nutritionContainer: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 4,
        overflow: "hidden",
    },
    nutritionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomColor: "#eee",
        borderBottomWidth: 1,
    },
    nutrientName: { fontSize: 16, color: "#444" },
    nutrientValue: { fontSize: 16, color: "#444" },
    bodyText: { fontSize: 16, color: "#555", lineHeight: 22, marginBottom: 12 },
});
