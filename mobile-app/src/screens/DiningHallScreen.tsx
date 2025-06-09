import React, { useState, useEffect } from "react";
import {
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/index";
import type { MenuItem, ConsolidatedMenu } from "../types";
import { CONSOLIDATED_URL } from "../config";

// A simple in-module cache so menu is only fetched once per app launch
export let cachedMenu: ConsolidatedMenu | null = null;

type Props = NativeStackScreenProps<RootStackParamList, "DiningHall">;

export default function DiningHallScreen({ route, navigation }: Props) {
    const { hallId, hallName } = route.params;

    // ─── STATE ──────────────────────────────────────────────────────────────────

    // Holds the fetched menu (either from cache or network)
    const [consolidatedMenu, setConsolidatedMenu] =
        useState<ConsolidatedMenu | null>(cachedMenu);

    // Tracks whether this is the first fetch
    const [loading, setLoading] = useState<boolean>(cachedMenu === null);

    // Show any error message if the fetch fails
    const [loadError, setLoadError] = useState<string | null>(null);

    // Keep track of which meal period is currently selected/viewed
    const [currentMeal, setCurrentMeal] = useState<string>("");

    // Keep track of which categories are "expanded" (true) vs "collapsed" (false)
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // ─── HELPER TO PICK “CURRENT” MEAL BASED ON TIME & AVAILABILITY ──────────────
    function pickCurrentMeal(
        hallObj: ConsolidatedMenu["dining_halls"][string]
    ): string {
        const now = new Date();
        const hr = now.getHours();

        // Rough "default" meal based on clock
        let tentative: string;
        if (hr < 11) tentative = "Breakfast";
        else if (hr < 14) tentative = "Lunch";
        else if (hr < 16.5) tentative = "Late Lunch";
        else tentative = "Dinner";

        // Define priority order of meals
        const order = [
            "Breakfast",
            "Continental",
            "Brunch",
            "Lunch",
            "Late Lunch",
            "Dinner",
        ];
        const idx = order.indexOf(tentative);

        // Fallback if 'tentative' meal is not found in the order
        if (idx === -1) return order[0];

        // Starting at the indexOf(tentative), check each meal in order
        for (let offset = 0; offset < order.length; offset++) {
            const meal = order[(idx + offset) % order.length];
            if (hallObj[meal] && hallObj[meal].available) {
                return meal;
            }
        }

        // If no meals are available, return the tentative one
        return tentative;
    }

    // ─── FETCH OR LOAD FROM CACHE ONCE ────────────────────────────────────────────
    useEffect(() => {
        // If we already have a cached menu, use it immediately (skip network fetch)
        if (cachedMenu) {
            setConsolidatedMenu(cachedMenu);
            setLoading(false);
            return;
        }

        // Otherwise, do a first-time fetch
        setLoading(true);
        setLoadError(null);

        fetch(CONSOLIDATED_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<ConsolidatedMenu>;
            })
            .then((json) => {
                cachedMenu = json; // store in module cache
                setConsolidatedMenu(json);
            })
            .catch((err) => {
                console.warn("Fetch error:", err);
                setLoadError("Unable to load menu data. Please try again.");
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // ─── ONCE MENU IS LOADED → PICK FIRST MEAL & RESET EXPANSIONS ──────────────────
    useEffect(() => {
        if (!consolidatedMenu) return;

        // Ensure the hallId exists in the consolidated menu
        const allHalls = consolidatedMenu.dining_halls;
        const hallObj = allHalls[hallId];
        if (!hallObj) {
            setLoadError(`No data found for "${hallId}"`);
            return;
        }

        // Choose the “default” meal based on clock & availability
        const chosenMeal = pickCurrentMeal(hallObj);
        setCurrentMeal(chosenMeal);

        // Build a fresh “collapsed” map for all categories of that meal
        const categoryNames = Object.keys(
            hallObj[chosenMeal]?.categories || {}
        );
        const initialExpanded: Record<string, boolean> = {};
        categoryNames.forEach((cat) => {
            initialExpanded[cat] = false;
        });
        setExpanded(initialExpanded);
    }, [consolidatedMenu, hallId]);

    // ─── WHEN USER CHOOSES A DIFFERENT MEAL → RESET EXPANSIONS AGAIN ──────────────
    useEffect(() => {
        if (!consolidatedMenu) return;

        const hallObj = consolidatedMenu.dining_halls[hallId];
        if (!hallObj) return;

        // Get categories for the newly selected `currentMeal`
        const categoryNames = Object.keys(
            hallObj[currentMeal]?.categories || {}
        );
        const resetExpanded: Record<string, boolean> = {};
        categoryNames.forEach((cat) => {
            resetExpanded[cat] = false;
        });
        setExpanded(resetExpanded);
    }, [currentMeal, consolidatedMenu, hallId]);

    // ─── EARLY RETURNS FOR LOADING / ERROR STATES ──────────────────────────────────
    if (loading) {
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

    // ─── AT THIS POINT, MENU IS LOADED & VALID ─────────────────────────────────────

    // Convenient reference to this hall’s data
    const hallObj = consolidatedMenu.dining_halls[hallId];

    // If, for some reason, there are no meal‐period keys at all,
    // show a “No menus available” placeholder.
    if (!hallObj || Object.keys(hallObj).length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                {/** Header (hall name + plate planner) remains the same */}
                <View style={styles.header}>
                    <Text style={styles.hallName}>{hallName}</Text>
                    <TouchableOpacity
                        style={styles.platePlannerButton}
                        onPress={() =>
                            navigation.navigate("PlatePlanner", {
                                hallId: hallId,
                                hallName: hallName,
                                mealPeriod: currentMeal,
                            })
                        }
                        activeOpacity={0.7}
                    >
                        <Text style={styles.buttonText}>Plate Planner</Text>
                    </TouchableOpacity>
                </View>

                {/* Placeholder when no meals are defined for this hall */}
                <View style={styles.noMenusContainer}>
                    <Text style={styles.noMenusText}>
                        No menus available today.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // ─── BUILD & SORT LIST OF MEAL KEYS ────────────────────────────────────────────
    const allMealKeys = Object.keys(hallObj);
    const PRIORITY_ORDER = [
        "Breakfast",
        "Continental",
        "Brunch",
        "Lunch",
        "Late Lunch",
        "Dinner",
    ];
    const mealKeys = allMealKeys.sort((a, b) => {
        const idxA = PRIORITY_ORDER.indexOf(a);
        const idxB = PRIORITY_ORDER.indexOf(b);

        // If both are in our priority array, sort by that index
        if (idxA !== -1 && idxB !== -1) {
            return idxA - idxB;
        }
        // If only A is prioritized, A comes first
        if (idxA !== -1) return -1;
        // If only B is prioritized, B comes first
        if (idxB !== -1) return 1;
        // Otherwise, fallback to alphabetical
        return a.localeCompare(b);
    });

    // ─── RENDER MAIN SCREEN ────────────────────────────────────────────────────────

    // Categories for the currentMeal (computed on the fly)
    const categories = Object.keys(hallObj[currentMeal]?.categories || {});

    return (
        <SafeAreaView style={styles.container}>
            {/** ─── HEADER: Hall Name + Plate Planner Button ─────────────────────────── **/}
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

            {/** ─── MEAL BAR: Tabs for Each Meal Period ─────────────────────────────── **/}
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
                                setCurrentMeal(meal);
                            }}
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

            {/** ─── BODY: Collapsible Categories + Item List ───────────────────────── **/}
            <ScrollView
                style={styles.body}
                contentContainerStyle={{ paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                {categories.length === 0 ? (
                    <View style={styles.noCategories}>
                        <Text style={styles.noCategoriesText}>
                            {hallObj[currentMeal]?.available === false
                                ? `There are no items available for ${currentMeal} at this time.`
                                : "Loading menu items..."}
                        </Text>
                    </View>
                ) : (
                    categories.map((categoryName) => {
                        const isExpanded = !!expanded[categoryName];
                        const itemsArray: MenuItem[] =
                            hallObj[currentMeal]?.categories[categoryName] ||
                            [];

                        return (
                            <View key={categoryName}>
                                {/** CATEGORY HEADER ───────────────────────────────────────── **/}
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

                                {/** ITEMS LIST (only if expanded) ────────────────────────── **/}
                                {isExpanded && (
                                    <View style={styles.itemsContainer}>
                                        {itemsArray.length === 0 ? (
                                            <Text style={styles.noItemsText}>
                                                (No items in this category.)
                                            </Text>
                                        ) : (
                                            itemsArray.map((item, idx) => {
                                                // Construct a stable key using category + item‐name + index
                                                const key = `${categoryName}-${item.name}-${idx}`;

                                                return (
                                                    <TouchableOpacity
                                                        key={key}
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
                                                                        item, // pass entire object to detail screen
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

// ─── STYLES ──────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    // Background color set to black to match ND dark theme
    container: {
        flex: 1,
        backgroundColor: "#000000",
    },

    // ─── HEADER ───────────────────────────────────────────────────────────────────
    header: {
        backgroundColor: "#0C234B",
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "column",
        alignItems: "center",
    },
    hallName: {
        color: "#FFFFFF",
        fontSize: 22,
        fontWeight: "700",
    },
    platePlannerButton: {
        backgroundColor: "#C99700",
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

    // ─── MEAL BAR ────────────────────────────────────────────────────────────────
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

    // ─── BODY: CATEGORY & ITEMS ────────────────────────────────────────────────
    body: {
        flex: 1,
        backgroundColor: "#000000",
    },
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
    noCategories: {
        marginTop: 60,
        alignItems: "center",
        paddingHorizontal: 32,
    },
    noCategoriesText: {
        color: "#FFFFFF",
        fontSize: 16,
        textAlign: "center",
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

    // ─── LOADING & ERROR STATES ─────────────────────────────────────────────────
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
});
