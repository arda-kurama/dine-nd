// src/screens/ItemList.tsx

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
import type { MenuDetail, MenuItem } from "../types";

import { DETAIL_URL } from "../config";

type ItemNavProp = NativeStackNavigationProp<RootStackParamList, "Items">;
type ItemRouteProp = RouteProp<RootStackParamList, "Items">;

export default function ItemList({
    navigation,
    route,
}: {
    navigation: ItemNavProp;
    route: ItemRouteProp;
}) {
    const { hall, meal, category } = route.params;

    const [detail, setDetail] = useState<MenuDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(DETAIL_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<MenuDetail>;
            })
            .then((json) => {
                setDetail(json);
            })
            .catch((e) => {
                console.warn("Failed to fetch consolidated_menu:", e);
                setError("Unable to load items. Please try again.");
            });
    }, []);

    if (!detail && !error) {
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

    if (!detail) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>
                    Unexpected error: missing items data.
                </Text>
            </View>
        );
    }

    // Extract the array of MenuItem for this hall/meal/category
    const items: MenuItem[] =
        detail.dining_halls[hall][meal].categories[category] || [];

    return (
        <View style={styles.container}>
            <Text style={styles.header}>
                {hall} — {meal} — {category}
            </Text>
            <FlatList
                data={items}
                keyExtractor={(item) => item.name}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.itemTouchable}
                        onPress={() =>
                            navigation.navigate("ItemDetail", { item })
                        }
                    >
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemServing}>
                            {item.serving_size}
                        </Text>
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
        fontSize: 20,
        fontWeight: "600",
        marginBottom: 12,
    },
    itemTouchable: {
        marginBottom: 12,
        paddingVertical: 8,
    },
    itemName: {
        fontSize: 18,
    },
    itemServing: {
        color: "#555",
    },
    errorText: {
        color: "red",
        fontSize: 16,
        textAlign: "center",
        padding: 16,
    },
});
