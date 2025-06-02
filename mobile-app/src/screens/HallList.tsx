import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Image,
    Dimensions,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/index";
import type { MenuSummary } from "../types";
import { SUMMARY_URL } from "../config";

type HallListNavProp = NativeStackNavigationProp<RootStackParamList, "Halls">;
type Props = {
    navigation: HallListNavProp;
};

// 1) Map each exact hall name to an image.
const hallImages: Record<string, { uri: string }> = {
    "Holy Cross College Dining Hall": {
        uri: "https://dining.nd.edu/stylesheets/images/hcc_dining_room.jpg",
    },
    "North Dining Hall": {
        uri: "https://dining.nd.edu/stylesheets/images/feature_NDH800.jpg",
    },
    "Saint Mary's Dining Hall": {
        uri: "https://dining.nd.edu/stylesheets/images/saint-marys-dining.jpg",
    },
    "South Dining Hall": {
        uri: "https://dining.nd.edu/stylesheets/images/feature_SDH800.jpg",
    },
};

export default function HallList({ navigation }: Props) {
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
                <ActivityIndicator size="large" color="#C99700" />
            </View>
        );
    }

    // 2) Error state
    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    // 3) Guard
    if (!summary) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>
                    Unexpected error: missing menu data.
                </Text>
            </View>
        );
    }

    // 4) Extract hall names
    const halls = Object.keys(summary.dining_halls);

    return (
        <View style={styles.container}>
            <FlatList
                data={halls}
                keyExtractor={(hallName) => hallName}
                renderItem={({ item: hallName }) => {
                    const mealCount = summary.dining_halls[hallName] ?? 0;
                    const hasMeals = mealCount > 0;

                    // Choose the correct image or fallback placeholder
                    const imageSource = hallImages[hallName] || {
                        uri: "https://your‐cdn.com/images/placeholder.jpg",
                    };

                    return (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() =>
                                navigation.navigate("DiningHall", {
                                    hallId: hallName,
                                    hallName: hallName,
                                })
                            }
                            style={styles.cardContainer}
                        >
                            {/* ─── IMAGE ─────────────────────────────────────────────────────────── */}
                            <Image
                                source={imageSource}
                                style={styles.hallImage}
                            />

                            {/* ─── CAPTION (gold bar) GOES HERE ──────────────────────────────────── */}
                            <View style={styles.captionContainer}>
                                <Text style={styles.hallTitle}>{hallName}</Text>

                                {/* Row with colored indicator + mealCount text */}
                                <View style={styles.statusRow}>
                                    <View
                                        style={[
                                            styles.statusIndicator,
                                            {
                                                backgroundColor: hasMeals
                                                    ? "#28a745"
                                                    : "#dc3545",
                                            },
                                        ]}
                                    />
                                    <Text style={styles.mealCountText}>
                                        {mealCount} meal
                                        {mealCount !== 1 ? "s" : ""}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const { width } = Dimensions.get("window");
const CARD_HEIGHT = 120;
const CARD_WIDTH = width - 32; // 16px padding on each side

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF", // White page background
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    errorText: {
        color: "red",
        fontSize: 16,
        textAlign: "center",
        padding: 16,
    },

    cardContainer: {
        // iOS shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        // Android elevation
        elevation: 5,
        borderRadius: 12,
        overflow: "hidden",
    },
    hallImage: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        justifyContent: "flex-end", // caption sits at bottom
    },
    imageStyle: {
        borderRadius: 12,
    },

    /* Caption (gold bar + white text) */
    captionContainer: {
        backgroundColor: "#C99700", // ND gold
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    hallTitle: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "600",
    },

    /* ─── STATUS ROW ────────────────────────────────────────────────────────────── */
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    statusIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 6,
    },
    mealCountText: {
        color: "#FFFFFF",
        fontSize: 14,
    },
});
