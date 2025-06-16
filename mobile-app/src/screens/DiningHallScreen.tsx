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

import type {
    MenuItem,
    ConsolidatedMenu,
    RootStackParamList,
} from "../components/types";
import { CONSOLIDATED_URL } from "../components/constants";

// Choose default meal that opens based on current time
function pickCurrentMeal(
    hallObj: Record<
        string,
        { available: boolean; categories: Record<string, MenuItem[]> }
    >
): string {
    const hr = new Date().getHours();
    let tentative =
        hr < 11
            ? "Breakfast"
            : hr < 14
            ? "Lunch"
            : hr < 16.5
            ? "Late Lunch"
            : "Dinner";
    const order = [
        "Breakfast",
        "Continental",
        "Brunch",
        "Lunch",
        "Late Lunch",
        "Dinner",
    ];
    const start = order.indexOf(tentative);
    if (start === -1) return order[0];
    for (let i = 0; i < order.length; i++) {
        const meal = order[(start + i) % order.length];
        if (hallObj[meal]?.available) return meal;
    }
    return tentative;
}

// Section definitions: group categories by matching names using regexes
const SECTION_DEFINITIONS: { title: string; match: (n: string) => boolean }[] =
    [
        {
            title: "Homestyle",
            match: (n) => /Homestyle|Breakfast|Bistro/.test(n),
        },
        { title: "Mexican", match: (n) => /^Mexican/.test(n) },
        { title: "Asian", match: (n) => /^Asian/.test(n) },
        { title: "Grill", match: (n) => /^Grill/.test(n) },
        {
            title: "Quesadilla",
            match: (n) => /^Quesadilla|Southwest Rice Bowl/.test(n),
        },
        {
            title: "Toasting Station",
            match: (n) => /^Toasting Station|^Bread/.test(n),
        },
        {
            title: "Waffle Bar",
            match: (n) => /^Waffle And Pancake/.test(n),
        },
        { title: "Oatmeal", match: (n) => /Oatmeal/.test(n) },
        { title: "Myo Omlette", match: (n) => /^Myo Omelette/.test(n) },
        { title: "Protein Bar", match: (n) => /Protein Bar/.test(n) },
        { title: "Pizza", match: (n) => /Pizzaria|^Myo Pizza/.test(n) },
        { title: "Pasta", match: (n) => /^Pasta/.test(n) },
        { title: "Deli", match: (n) => /^Deli/.test(n) },
        { title: "Salad Bar", match: (n) => /^Salad Bar/.test(n) },
        { title: "Vegan", match: (n) => /^Vegan/.test(n) },
        { title: "Soup", match: (n) => /Soup/.test(n) },
        { title: "Fresh Fruit", match: (n) => /Fresh Fruit|Fruit/.test(n) },
        { title: "Yogurt & Cereal", match: (n) => /Yogurt|Cereal/.test(n) },
        {
            title: "Dessert",
            match: (n) => /^Dessert|Soft Serve|Toppings|Pastries/.test(n),
        },
        {
            title: "Drinks",
            match: (n) =>
                /Fountain Drinks|Juice|Milk|Coffee & Tea|Beverage/.test(n),
        },
    ];

type Props = NativeStackScreenProps<RootStackParamList, "DiningHall">;

export default function DiningHallScreen({ route, navigation }: Props) {
    const { hallId, hallName } = route.params;
    const [diningHalls, setDiningHalls] = useState<
        ConsolidatedMenu["dining_halls"] | null
    >(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [currentMeal, setCurrentMeal] = useState("");
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Fetch data
    useEffect(() => {
        setLoading(true);
        fetch(`${CONSOLIDATED_URL}?hall=${hallId}`)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json() as Promise<ConsolidatedMenu>;
            })
            .then((menu) => {
                setDiningHalls(menu.dining_halls);
                setLoadError(null);
            })
            .catch((e) => setLoadError(e.message))
            .finally(() => setLoading(false));
    }, [hallId]);

    // Initialize meal and expansion
    useEffect(() => {
        if (!diningHalls) return;
        const hallObj = diningHalls[hallId];
        if (!hallObj) {
            setLoadError(`No data for "${hallId}"`);
            return;
        }
        if (!currentMeal) setCurrentMeal(pickCurrentMeal(hallObj));
        const cats = Object.keys(hallObj[currentMeal]?.categories || {});
        setExpanded(
            cats.reduce(
                (p, n) => ({ ...p, [n]: false }),
                {} as Record<string, boolean>
            )
        );
    }, [diningHalls, currentMeal, hallId]);

    // Loading & error
    if (loading)
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#C99700" />
                    <Text style={styles.loadingText}>Loading menu…</Text>
                </View>
            </SafeAreaView>
        );
    if (loadError)
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>{loadError}</Text>
            </SafeAreaView>
        );

    const hallObj = diningHalls![hallId]!;
    const mealKeys = Object.keys(hallObj);
    const allCategories = Object.keys(hallObj[currentMeal]?.categories || {});

    // Group categories
    const sectionMap: Record<string, string[]> = {};
    SECTION_DEFINITIONS.forEach((d) => (sectionMap[d.title] = []));
    const other: string[] = [];
    allCategories.forEach((cat) => {
        const def = SECTION_DEFINITIONS.find((d) => d.match(cat));
        def ? sectionMap[def.title].push(cat) : other.push(cat);
    });

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
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
                    <Text style={styles.platePlannerButtonText}>
                        Plan My Plate
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Meal switcher - navy text */}
            <View style={styles.mealSwitcher}>
                {mealKeys.map((meal) => (
                    <TouchableOpacity
                        key={meal}
                        style={[
                            styles.mealButton,
                            meal === currentMeal && styles.selectedMealButton,
                        ]}
                        onPress={() => setCurrentMeal(meal)}
                        disabled={!hallObj[meal]?.available}
                    >
                        <Text
                            style={[
                                styles.mealText,
                                meal === currentMeal && styles.selectedMealText,
                                !hallObj[meal]?.available &&
                                    styles.disabledMealText,
                            ]}
                        >
                            {meal}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Sections */}
            <ScrollView
                style={styles.body}
                contentContainerStyle={{ paddingBottom: 32 }}
            >
                {allCategories.length === 0 ? (
                    <View style={styles.noCategories}>
                        <Text style={styles.noCategoriesText}>
                            {hallObj[currentMeal]?.available === false
                                ? `No items for ${currentMeal}.`
                                : "Loading items..."}
                        </Text>
                    </View>
                ) : (
                    <>
                        {SECTION_DEFINITIONS.map((def) => {
                            const cats = sectionMap[def.title];
                            if (!cats.length) return null;
                            return (
                                <View
                                    key={def.title}
                                    style={styles.sectionContainer}
                                >
                                    <Text style={styles.sectionHeader}>
                                        {def.title}
                                    </Text>
                                    {cats.map((cat) => (
                                        <CategoryBlock
                                            key={cat}
                                            category={cat}
                                            items={
                                                hallObj[currentMeal]
                                                    ?.categories[cat] || []
                                            }
                                            expanded={expanded[cat]}
                                            onToggle={() =>
                                                setExpanded((p) => ({
                                                    ...p,
                                                    [cat]: !p[cat],
                                                }))
                                            }
                                            navigation={navigation}
                                            hallId={hallId}
                                            meal={currentMeal}
                                        />
                                    ))}
                                </View>
                            );
                        })}
                        {other.length > 0 && (
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionHeader}>Other</Text>
                                {other.map((cat) => (
                                    <CategoryBlock
                                        key={cat}
                                        category={cat}
                                        items={
                                            hallObj[currentMeal]?.categories[
                                                cat
                                            ] || []
                                        }
                                        expanded={expanded[cat]}
                                        onToggle={() =>
                                            setExpanded((p) => ({
                                                ...p,
                                                [cat]: !p[cat],
                                            }))
                                        }
                                        navigation={navigation}
                                        hallId={hallId}
                                        meal={currentMeal}
                                    />
                                ))}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function CategoryBlock({
    category,
    items,
    expanded,
    onToggle,
    navigation,
    hallId,
    meal,
}: {
    category: string;
    items: MenuItem[];
    expanded: boolean;
    onToggle(): void;
    navigation: any;
    hallId: string;
    meal: string;
}) {
    return (
        <View>
            <TouchableOpacity
                style={styles.categoryHeader}
                onPress={onToggle}
                activeOpacity={0.7}
            >
                <Text style={styles.categoryTitle}>{category}</Text>
                <Text style={styles.arrow}>{expanded ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {expanded && (
                <View style={styles.itemsContainer}>
                    {items.length === 0 ? (
                        <Text style={styles.noItemsText}>(No items)</Text>
                    ) : (
                        items.map((item, i) => (
                            <TouchableOpacity
                                key={`${category}-${i}`}
                                style={styles.itemRow}
                                onPress={() =>
                                    navigation.navigate("ItemDetail", {
                                        hallId,
                                        mealPeriod: meal,
                                        categoryId: category,
                                        itemDetail: item,
                                    })
                                }
                            >
                                <Text style={styles.itemText}>{item.name}</Text>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8F8F8" },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        backgroundColor: "#0C234B",
    },
    hallName: { fontSize: 24, fontWeight: "700", color: "#FFFFFF" },
    platePlannerButton: {
        backgroundColor: "#C99700",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 4,
    },
    platePlannerButtonText: { color: "#FFFFFF", fontWeight: "600" },
    mealSwitcher: {
        flexDirection: "row",
        justifyContent: "space-around",
        backgroundColor: "#FFFFFF",
        paddingVertical: 8,
    },
    mealButton: { paddingVertical: 6, paddingHorizontal: 12 },
    selectedMealButton: { borderBottomWidth: 2, borderColor: "#C99700" },
    mealText: { fontSize: 16, color: "#0C234B" },
    selectedMealText: { fontWeight: "700", color: "#0C234B" },
    disabledMealText: { color: "#CCCCCC" },
    body: { flex: 1 },
    noCategories: { padding: 16, alignItems: "center" },
    noCategoriesText: { fontSize: 16, color: "#666666" },
    categoryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 16,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderColor: "#EEEEEE",
    },
    categoryTitle: { fontSize: 16, fontWeight: "600" },
    arrow: { fontSize: 12 },
    itemsContainer: { paddingLeft: 24, backgroundColor: "#FAFAFA" },
    itemRow: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: "#EEEEEE",
    },
    itemText: { fontSize: 14 },
    noItemsText: { fontStyle: "italic", color: "#999999", padding: 16 },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0C234B",
    },
    loadingText: { color: "#FFFFFF", marginTop: 8 },
    errorText: { color: "red", fontSize: 16, textAlign: "center", padding: 16 },
    sectionContainer: { marginBottom: 24 },
    sectionHeader: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
        paddingHorizontal: 16,
    },
});
