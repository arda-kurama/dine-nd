// src/screens/HallList.tsx

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
import type { RootStackParamList } from "../navigation";
import type { MenuSummary } from "../types";

import { SUMMARY_URL } from "../config";

type HallListNavProp = NativeStackNavigationProp<RootStackParamList, "Halls">;

export default function HallList({
    navigation,
}: {
    navigation: HallListNavProp;
}) {
    const [summary, setSummary] = useState<MenuSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(SUMMARY_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<MenuSummary>;
            })
            .then((json) => setSummary(json))
            .catch((e) => {
                console.warn("Failed to fetch summary:", e);
                setError("Could not load menu. Please try again.");
            });
    }, []);

    // 1) Loading state
    if (!summary && !error) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // 2) Fetch error
    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    // 3) Spare guard so TS knows summary is non-null
    if (!summary) {
        // This “should never happen” because of the two early returns above,
        // but this line satisfies TypeScript’s type checker.
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>
                    Unexpected error: missing menu data.
                </Text>
            </View>
        );
    }

    // 4) Now TypeScript knows summary is MenuSummary (not null)
    const halls = Object.keys(summary.dining_halls);

    return (
        <View style={styles.container}>
            <FlatList
                data={halls}
                keyExtractor={(hallName) => hallName}
                renderItem={({ item: hallName }) => (
                    <TouchableOpacity
                        style={styles.rowTouchable}
                        onPress={() =>
                            navigation.navigate("Meals", { hall: hallName })
                        }
                    >
                        <Text style={styles.rowText}>{hallName}</Text>
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
    errorText: {
        color: "red",
        fontSize: 16,
        textAlign: "center",
        padding: 16,
    },
    rowTouchable: {
        paddingVertical: 12,
    },
    rowText: {
        fontSize: 18,
    },
});
