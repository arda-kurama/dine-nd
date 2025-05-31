// src/screens/CategoryList.tsx

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

type CatNavProp = NativeStackNavigationProp<RootStackParamList, "Categories">;
type CatRouteProp = RouteProp<RootStackParamList, "Categories">;

export default function CategoryList({
    navigation,
    route,
}: {
    navigation: CatNavProp;
    route: CatRouteProp;
}) {
    const { hall, meal } = route.params;

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
                setError("Unable to load categories. Please try again.");
            });
    }, []);

    if (!summary && !error) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    if (!summary) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>
                    Unexpected error: missing menu data.
                </Text>
            </View>
        );
    }

    // Pull out the categories array for this hall + meal
    const categories = summary.dining_halls[hall][meal].categories || [];

    return (
        <View style={styles.container}>
            <Text style={styles.header}>
                {hall} — {meal}
            </Text>
            <FlatList
                data={categories}
                keyExtractor={(c) => c}
                renderItem={({ item: categoryName }) => (
                    <TouchableOpacity
                        style={styles.rowTouchable}
                        onPress={() =>
                            navigation.navigate("Items", {
                                hall,
                                meal,
                                category: categoryName,
                            })
                        }
                    >
                        <Text style={styles.rowText}>{categoryName}</Text>
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
