// src/screens/MealPeriods.tsx

import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
} from "react-native";

import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation";
import type { MenuSummary } from "../types";

import { SUMMARY_URL } from "../config";

type MealNavProp = NativeStackNavigationProp<RootStackParamList, "Meals">;
type MealRouteProp = RouteProp<RootStackParamList, "Meals">;

export default function MealPeriods({
    navigation,
    route,
}: {
    navigation: MealNavProp;
    route: MealRouteProp;
}) {
    const { hall } = route.params;

    // (1) Local state for fetched summary
    const [summary, setSummary] = useState<MenuSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(SUMMARY_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<MenuSummary>;
            })
            .then((json) => {
                setSummary(json);
            })
            .catch((e) => {
                console.warn("Failed to fetch menu_summary:", e);
                setError("Unable to load meals. Please try again.");
            });
    }, []);

    // (2) Loading state
    if (!summary && !error) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // (3) Error state
    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    // (4) Guard: now summary is definitely not null
    if (!summary) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>
                    Unexpected error: missing menu data.
                </Text>
            </View>
        );
    }

    // (5) Extract available meals for this hall
    // summary.dining_halls[hall] is an object whose keys are meal names (Breakfast, Lunch, etc.).
    const mealsObj = summary.dining_halls[hall] || {};
    const meals = Object.entries(mealsObj)
        .filter(([_, mealInfo]) => mealInfo.available)
        .map(([mealName]) => mealName);

    return (
        <View style={styles.container}>
            <Text style={styles.header}>{hall}</Text>
            <FlatList
                data={meals}
                keyExtractor={(m) => m}
                renderItem={({ item: mealName }) => (
                    <TouchableOpacity
                        style={styles.rowTouchable}
                        onPress={() =>
                            navigation.navigate("Categories", {
                                hall,
                                meal: mealName,
                            })
                        }
                    >
                        <Text style={styles.rowText}>{mealName}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        fontSize: 22,
        fontWeight: "600",
        marginBottom: 12,
    },
    rowTouchable: {
        paddingVertical: 12,
    },
    rowText: {
        fontSize: 18,
    },
    errorText: {
        color: "red",
        fontSize: 16,
        textAlign: "center",
        padding: 16,
    },
});
