import React, { useState, useEffect } from "react";
import {
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/index"; // Adjust path if needed
import type { MenuItem, ConsolidatedMenu } from "../types";
import { CONSOLIDATED_URL } from "../config";

// Keeps the fetched JSON in memory for the entire app‐lifecycle.
let cachedMenu: ConsolidatedMenu | null = null;

// Screen props type
type Props = NativeStackScreenProps<RootStackParamList, "DiningHall">;

export default function DiningHallScreen({ route, navigation }: Props) {
    const { hallId, hallName } = route.params;

    // 1) Initialize `consolidatedMenu` from cachedMenu (if it exists)
    const [consolidatedMenu, setConsolidatedMenu] =
        useState<ConsolidatedMenu | null>(cachedMenu);

    // 2) Loading is true only if cachedMenu is null (i.e. first time)
    const [loading, setLoading] = useState<boolean>(cachedMenu === null);

    // 3) If there was an error fetching, show it
    const [loadError, setLoadError] = useState<string | null>(null);

    // 4) Which meal period is active ("Breakfast", "Lunch", "Late Lunch", "Dinner")
    const [currentMeal, setCurrentMeal] = useState<string>("");

    // 5) Category names for the chosen meal
    const [categories, setCategories] = useState<string[]>([]);

    // 6) Track which category headers are expanded
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // HELPER: pick the “current” meal by clock & availability
    function pickCurrentMeal(
        hallObj: ConsolidatedMenu["dining_halls"][string]
    ): string {
        const now = new Date();
        const hr = now.getHours();

        let tentative: string;
        if (hr < 11) tentative = "Breakfast";
        else if (hr < 14) tentative = "Lunch";
        else if (hr < 16.5) tentative = "Late Lunch";
        else tentative = "Dinner";

        const order = [
            "Breakfast",
            "Continental",
            "Brunch",
            "Lunch",
            "Late Lunch",
            "Dinner",
        ];
        const idx = order.indexOf(tentative);
        if (idx === -1) return order[0];

        for (let offset = 0; offset < order.length; offset++) {
            const meal = order[(idx + offset) % order.length];
            if (hallObj[meal] && hallObj[meal].available) {
                return meal;
            }
        }

        return tentative;
    }

    // 1) On initial mount, either fetch consolidated menu from network or use cachedMenu if it exists.
    useEffect(() => {
        // If we've already fetched once, `cachedMenu` is non-null.
        // In that case, we just set it into state and skip the fetch.
        if (cachedMenu) {
            setConsolidatedMenu(cachedMenu);
            setLoading(false);
            return;
        }

        // Otherwise, this is the very first time we mount → fetch from network.
        setLoading(true);
        setLoadError(null);

        fetch(CONSOLIDATED_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<ConsolidatedMenu>;
            })
            .then((json) => {
                cachedMenu = json; // store it in the module‐level cache
                setConsolidatedMenu(json);
            })
            .catch((err) => {
                console.warn("Fetch error:", err);
                setLoadError("Unable to load menu data. Please try again.");
            })
            .finally(() => {
                setLoading(false);
            });
    }, []); // <-- empty array → run only on initial mount

    // 2) WHEN consolidatedMenu IS READY → PICK MEAL & SET CATEGORIES
    useEffect(() => {
        if (!consolidatedMenu) return;

        const allHalls = consolidatedMenu.dining_halls;
        const hallObj = allHalls[hallId];
        if (!hallObj) {
            setLoadError(`No data found for "${hallId}"`);
            return;
        }

        const chosen = pickCurrentMeal(hallObj);
        setCurrentMeal(chosen);

        const catsObj = hallObj[chosen]?.categories || {};
        const catNames = Object.keys(catsObj);
        setCategories(catNames);

        // Reset expansions
        const collapsed: Record<string, boolean> = {};
        catNames.forEach((cat) => (collapsed[cat] = false));
        setExpanded(collapsed);
    }, [consolidatedMenu, hallId]);

    // 3) WHEN currentMeal CHANGES → UPDATE categories & RESET expansions
    useEffect(() => {
        if (!consolidatedMenu) return;
        const hallObj = consolidatedMenu.dining_halls[hallId];
        if (!hallObj) return;

        const catsObj = hallObj[currentMeal]?.categories || {};
        const catNames = Object.keys(catsObj);
        setCategories(catNames);

        const collapsed: Record<string, boolean> = {};
        catNames.forEach((cat) => (collapsed[cat] = false));
        setExpanded(collapsed);
    }, [currentMeal, consolidatedMenu, hallId]);

    // RENDER
    if (loading) {
        // Only shown if this is the very first time and `cachedMenu === null`.
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#C99700" />
                    <Text style={styles.loadingText}>Loading menu…</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (loadError || !consolidatedMenu) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>
                        {loadError || "Unexpected error."}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // At this point, `consolidatedMenu` is guaranteed non-null and loaded (either from cache or fresh fetch).
    const hallObj = consolidatedMenu.dining_halls[hallId];
    // ─── If no meal period is available today, show a “No menus” message ─────────────
    if (Object.keys(hallObj).length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                {/** Header stays unchanged **/}
                <View style={styles.header}>
                    <Text style={styles.hallName}>{hallName}</Text>
                    <TouchableOpacity
                        style={styles.platePlannerButton}
                        onPress={() =>
                            navigation.navigate("PlatePlanner", {
                                hallId,
                                hallName,
                                mealPeriod: "",
                            })
                        }
                        activeOpacity={0.7}
                    >
                        <Text style={styles.buttonText}>Plate Planner</Text>
                    </TouchableOpacity>
                </View>

                {/* “No menus available today” placeholder */}
                <View style={styles.noMenusContainer}>
                    <Text style={styles.noMenusText}>
                        No menus available today.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // 2) Sort them in a stable order, if desired
    const allMeals = Object.keys(hallObj);
    const PRIORITY = [
        "Breakfast",
        "Continental",
        "Brunch",
        "Lunch",
        "Late Lunch",
        "Dinner",
    ];
    const mealKeys = allMeals.sort((a, b) => {
        const aIdx = PRIORITY.indexOf(a);
        const bIdx = PRIORITY.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.localeCompare(b);
    });

    return (
        <SafeAreaView style={styles.container}>
            {/** ─── HEADER: Hall Name + Plate Planner Button ───────────────────────── **/}
            <View style={styles.header}>
                <Text style={styles.hallName}>{hallName}</Text>
                <TouchableOpacity
                    style={styles.platePlannerButton}
                    onPress={() =>
                        navigation.navigate("PlatePlanner", {
                            hallId,
                            hallName,
                            mealPeriod: currentMeal,
                        })
                    }
                    activeOpacity={0.7}
                >
                    <Text style={styles.buttonText}>Plate Planner</Text>
                </TouchableOpacity>
            </View>

            {/** ─── MEAL BAR: Tabs for each meal period ───────────────────────────── **/}
            <View style={styles.mealBar}>
                {mealKeys.map((meal) => {
                    const isAvailable = hallObj[meal]?.available;
                    const isSelected = meal === currentMeal;
                    return (
                        <TouchableOpacity
                            key={meal}
                            style={[
                                styles.mealTab,
                                isSelected && styles.selectedMealTab,
                                !isAvailable && styles.disabledMealTab,
                            ]}
                            onPress={() => {
                                if (isAvailable) setCurrentMeal(meal);
                                else
                                    Alert.alert(
                                        "Not available",
                                        `${meal} is not available right now.`
                                    );
                            }}
                            activeOpacity={isAvailable ? 0.7 : 1}
                        >
                            <Text
                                style={[
                                    styles.mealText,
                                    isSelected && styles.selectedMealText,
                                    !isAvailable && styles.disabledMealText,
                                ]}
                            >
                                {meal}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/** ─── BODY: Collapsible Categories + Items ─────────────────────────────── **/}
            <ScrollView
                style={styles.body}
                contentContainerStyle={{ paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                {categories.length === 0 ? (
                    <View style={styles.noCategories}>
                        <Text style={styles.noCategoriesText}>
                            {hallObj[currentMeal]?.available === false
                                ? `${currentMeal} is not available.`
                                : "(No categories to show.)"}
                        </Text>
                    </View>
                ) : (
                    categories.map((categoryName) => {
                        const isExpanded = expanded[categoryName] || false;
                        const itemsArray: MenuItem[] =
                            hallObj[currentMeal]?.categories[categoryName] ||
                            [];

                        return (
                            <View key={categoryName}>
                                {/** CATEGORY HEADER **/}
                                <TouchableOpacity
                                    style={styles.categoryHeader}
                                    onPress={() =>
                                        setExpanded((prev) => ({
                                            ...prev,
                                            [categoryName]: !prev[categoryName],
                                        }))
                                    }
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.categoryTitle}>
                                        {categoryName}
                                    </Text>
                                    <Text style={styles.arrow}>
                                        {isExpanded ? "▲" : "▼"}
                                    </Text>
                                </TouchableOpacity>

                                {/** ITEMS (only if expanded) **/}
                                {isExpanded && (
                                    <View style={styles.itemsContainer}>
                                        {itemsArray.length === 0 ? (
                                            <Text style={styles.noItemsText}>
                                                (No items in this category.)
                                            </Text>
                                        ) : (
                                            itemsArray.map((item, idx) => {
                                                const uniqueKey = `${categoryName}-${item.name}-${idx}`;
                                                return (
                                                    <TouchableOpacity
                                                        key={uniqueKey}
                                                        style={styles.itemRow}
                                                        onPress={() =>
                                                            navigation.navigate(
                                                                "ItemDetail",
                                                                {
                                                                    hallId,
                                                                    mealPeriod:
                                                                        currentMeal,
                                                                    categoryId:
                                                                        categoryName,
                                                                    itemDetail:
                                                                        item, // ← pass the entire object
                                                                }
                                                            )
                                                        }
                                                    >
                                                        <Text
                                                            style={
                                                                styles.itemText
                                                            }
                                                        >
                                                            {item.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── STYLES (Notre Dame Colors) ─────────────────────────────────────────────────
const styles = StyleSheet.create({
    noMenusContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    noMenusText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "500",
    },
    container: {
        flex: 1,
        backgroundColor: "#000000",
    },
    header: {
        backgroundColor: "#0C234B", // ND blue
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
    },
    hallName: {
        color: "#FFFFFF",
        fontSize: 22,
        fontWeight: "700",
    },
    platePlannerButton: {
        backgroundColor: "#C99700", // ND gold
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 4,
        marginTop: 12,
    },
    buttonText: {
        color: "#0C234B",
        fontSize: 16,
        fontWeight: "600",
    },

    mealBar: {
        flexDirection: "row",
        backgroundColor: "#0C234B",
    },
    mealTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
    },
    mealText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "500",
    },
    selectedMealTab: {
        borderBottomWidth: 2,
        borderBottomColor: "#C99700",
    },
    selectedMealText: {
        color: "#C99700",
        fontWeight: "700",
    },
    disabledMealTab: {
        backgroundColor: "#1C1C1E",
    },
    disabledMealText: {
        color: "#555555",
    },

    body: {
        flex: 1,
        backgroundColor: "#000000",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: "#FFFFFF",
        marginTop: 8,
    },
    errorText: {
        color: "red",
        fontSize: 16,
        textAlign: "center",
        padding: 16,
    },

    noCategories: {
        marginTop: 60,
        alignItems: "center",
    },
    noCategoriesText: {
        color: "#FFFFFF",
        fontSize: 16,
    },

    categoryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#1C1C1E",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomColor: "#2C2C2E",
        borderBottomWidth: 1,
    },
    categoryTitle: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "600",
    },
    arrow: {
        color: "#C99700",
        fontSize: 16,
        fontWeight: "600",
    },

    itemsContainer: {
        backgroundColor: "#1C1C1E",
    },
    noItemsText: {
        color: "#AAAAAA",
        fontSize: 14,
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    itemRow: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomColor: "#2C2C2E",
        borderBottomWidth: 1,
    },
    itemText: {
        color: "#FFFFFF",
        fontSize: 15,
    },
});
