import React, { useState, useEffect, useMemo } from "react";
import {
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    TextInput,
    FlatList,
} from "react-native";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type {
    MenuItem,
    ConsolidatedMenu,
    RootStackParamList,
} from "../components/types";
import { CONSOLIDATED_URL, SECTION_DEFINITIONS } from "../components/constants";
import {
    colors,
    spacing,
    typography,
    radii,
    shadows,
} from "../components/themes";

// Define navigation prop type specific to this screen
type Props = NativeStackScreenProps<RootStackParamList, "DiningHall">;

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

// Screen component for showing the full dining hall menu
export default function DiningHallScreen({ route, navigation }: Props) {
    const { hallId, hallName } = route.params;

    // State variables for managing menu data, loading state, and errors
    const [diningHalls, setDiningHalls] = useState<
        ConsolidatedMenu["dining_halls"] | null
    >(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [currentMeal, setCurrentMeal] = useState("");
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // State vars for my plate
    const [overlayVisible, setOverlayVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItems, setSelectedItems] = useState<MenuItem[]>([]);

    // Fetch consolidated menu data
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

    // Select the default meal and initialize expanded categories
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

    // Compute the flat list of all available items for the current meal
    const allItems = useMemo(() => {
        if (!diningHalls || !hallId || !currentMeal) return [];
        const categories = diningHalls[hallId]?.[currentMeal]?.categories || {};
        return Object.values(categories).flat();
    }, [diningHalls, hallId, currentMeal]);

    // Filter items based on search query
    const filteredItems = useMemo(() => {
        return allItems.filter((item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, allItems]);

    // Helper for number parsing
    const parseNumber = (x: any) =>
        typeof x === "number"
            ? x
            : typeof x === "string"
            ? parseFloat(x.trim())
            : 0;

    // Helper to create a flat list of only unique items
    const uniqueItems = useMemo(() => {
        const seen = new Set();
        return filteredItems.filter((item) => {
            const key = item.name.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [filteredItems]);

    // Helper to sort selected items to top of list
    const sortedItems = useMemo(() => {
        return [...uniqueItems].sort((a, b) => {
            const aSelected = selectedItems.some((x) => x.name === a.name);
            const bSelected = selectedItems.some((x) => x.name === b.name);
            return Number(bSelected) - Number(aSelected);
        });
    }, [uniqueItems, selectedItems]);

    // Calculate macros
    const totalMacros = useMemo(() => {
        return selectedItems.reduce(
            (totals, item) => ({
                calories:
                    totals.calories + parseNumber(item.nutrition.calories),
                protein: totals.protein + parseNumber(item.nutrition.protein),
                carbs:
                    totals.carbs +
                    parseNumber(item.nutrition.total_carbohydrate),
                fat: totals.fat + parseNumber(item.nutrition.total_fat),
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
    }, [selectedItems]);

    // Handle loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Loading menu…</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Handle error state
    if (loadError) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>{loadError}</Text>
            </SafeAreaView>
        );
    }

    // Handle null diningHalls
    if (!diningHalls) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>
                    No dining hall data available
                </Text>
            </SafeAreaView>
        );
    }

    // Handle invalid hallId
    const hallObj = diningHalls[hallId];
    if (!hallObj) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>No data for "{hallId}"</Text>
            </SafeAreaView>
        );
    }

    // Handle case where no meals are available
    const mealKeys = Object.keys(hallObj);
    const anyMealOpen = mealKeys.some((meal) => hallObj[meal]?.available);
    if (!anyMealOpen) {
        return (
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.hallName}>{hallName}</Text>
                </View>

                {/* Closed-Today Message */}
                <View style={styles.closedContainer}>
                    <Text style={styles.closedTitle}>
                        {hallName} is closed today.
                    </Text>
                    <Text style={styles.closedSubtitle}>
                        Check back tomorrow or try another dining hall.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Normal case: render all sections
    const allCategories = Object.keys(hallObj[currentMeal]?.categories || {});

    // Organize categories into sections based on definitions or mark it as "Other"
    const sectionMap: Record<string, string[]> = {};
    SECTION_DEFINITIONS.forEach((d) => (sectionMap[d.title] = []));
    const other: string[] = [];
    allCategories.forEach((cat) => {
        const def = SECTION_DEFINITIONS.find((d) => d.match(cat));
        def ? sectionMap[def.title].push(cat) : other.push(cat);
    });

    // Render screen
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

            {/* Meal switcher */}
            <View style={styles.pillWrapper}>
                <View style={styles.mealSwitcherContainer}>
                    {mealKeys.map((meal) => (
                        <TouchableOpacity
                            key={meal}
                            onPress={() => setCurrentMeal(meal)}
                            style={[
                                styles.mealSwitcherBtn,
                                meal === currentMeal
                                    ? styles.mealSwitcherBtnActive
                                    : styles.mealSwitcherBtnUnselected,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.mealSwitcherTxt,
                                    meal === currentMeal
                                        ? styles.mealSwitcherTxtActive
                                        : styles.mealSwitcherTxtUnselected,
                                ]}
                            >
                                {meal}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Sections */}
            <ScrollView
                style={styles.body}
                contentContainerStyle={{ paddingBottom: spacing.lg }}
            >
                {SECTION_DEFINITIONS.map((def) => {
                    const cats = sectionMap[def.title];
                    if (!cats.length) return null;
                    return (
                        <View key={def.title} style={styles.sectionContainer}>
                            <Text style={styles.sectionHeader}>
                                {def.title}
                            </Text>
                            {cats.map((cat) => (
                                <CategoryBlock
                                    key={cat}
                                    category={cat}
                                    items={
                                        hallObj[currentMeal]?.categories[cat] ||
                                        []
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
                                    selectedItems={selectedItems}
                                    setSelectedItems={setSelectedItems}
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
                                    hallObj[currentMeal]?.categories[cat] || []
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
                                selectedItems={selectedItems}
                                setSelectedItems={setSelectedItems}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
            {/* Floating Plate Button */}
            <TouchableOpacity
                style={styles.floatingButton}
                onPress={() => setOverlayVisible(true)}
            >
                <Ionicons name="restaurant" size={40} color="#fff" />
            </TouchableOpacity>

            {/* Modal Overlay */}
            <Modal
                isVisible={overlayVisible}
                onBackdropPress={() => setOverlayVisible(false)}
                style={styles.modalStyle}
            >
                <View style={styles.macroHeader}>
                    <Text style={styles.macroHeading}>My Plate</Text>
                    <Text style={styles.macroLine}>
                        Calories: {totalMacros.calories} kcal
                    </Text>
                    <Text style={styles.macroLine}>
                        Protein: {totalMacros.protein} g
                    </Text>
                    <Text style={styles.macroLine}>
                        Carbs: {totalMacros.carbs} g
                    </Text>
                    <Text style={styles.macroLine}>
                        Fat: {totalMacros.fat} g
                    </Text>
                </View>
                <View style={styles.overlay}>
                    <TextInput
                        style={styles.searchBar}
                        placeholder="Search meal items..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <FlatList
                        data={sortedItems}
                        keyExtractor={(item, index) => `${item.name}-${index}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.itemRow}
                                onPress={() =>
                                    setSelectedItems((prev) =>
                                        prev.includes(item)
                                            ? prev.filter(
                                                  (i) => i.name !== item.name
                                              )
                                            : [...prev, item]
                                    )
                                }
                            >
                                <Text
                                    style={{
                                        ...typography.body,
                                        color: selectedItems.includes(item)
                                            ? colors.accent
                                            : colors.textPrimary,
                                    }}
                                >
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ paddingBottom: spacing.lg }}
                    />
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// Component for rendering a category block with items
function CategoryBlock({
    category,
    items,
    expanded,
    onToggle,
    navigation,
    hallId,
    meal,
    selectedItems,
    setSelectedItems,
}: {
    category: string;
    items: MenuItem[];
    expanded: boolean;
    onToggle(): void;
    navigation: any;
    hallId: string;
    meal: string;
    selectedItems: MenuItem[];
    setSelectedItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
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
                        items.map((item, i) => {
                            const isSelected = selectedItems.some(
                                (x) => x.name === item.name
                            );
                            return (
                                <View
                                    key={`${category}-${i}`}
                                    style={[
                                        styles.itemRow,
                                        isSelected && {
                                            backgroundColor:
                                                colors.accent + "22",
                                        },
                                    ]}
                                >
                                    {/* Left side: item name → navigates to ItemDetail */}
                                    <TouchableOpacity
                                        onPress={() =>
                                            navigation.navigate("ItemDetail", {
                                                hallId,
                                                mealPeriod: meal,
                                                categoryId: category,
                                                itemDetail: item,
                                            })
                                        }
                                        style={{ flex: 1 }}
                                    >
                                        <Text
                                            style={[
                                                styles.itemText,
                                                isSelected && {
                                                    color: colors.accent,
                                                },
                                            ]}
                                        >
                                            {item.name}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Right side: + button → toggle selection */}
                                    <TouchableOpacity
                                        onPress={() =>
                                            setSelectedItems((prev) =>
                                                isSelected
                                                    ? prev.filter(
                                                          (x) =>
                                                              x.name !==
                                                              item.name
                                                      )
                                                    : [...prev, item]
                                            )
                                        }
                                        hitSlop={{
                                            top: 16,
                                            bottom: 16,
                                            left: 16,
                                            right: 16,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...typography.button,
                                                fontWeight: "700",
                                                color: isSelected
                                                    ? colors.accent
                                                    : colors.textSecondary,
                                                paddingLeft: spacing.md,
                                            }}
                                        >
                                            {isSelected ? "–" : "+"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    header: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        padding: spacing.md,
        backgroundColor: colors.primary,
    },
    hallName: {
        ...typography.h1,
        color: colors.background,
        flex: 1,
        flexWrap: "wrap",
        marginRight: spacing.md,
    },
    platePlannerButton: {
        flexShrink: 0,
        backgroundColor: colors.accent,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: spacing.xs,
    },
    platePlannerButtonText: {
        ...typography.button,
        color: colors.background,
    },

    closedContainer: {
        flex: 1,
        justifyContent: "flex-start",
        marginTop: spacing.md,
        alignItems: "center",
        padding: spacing.md,
    },
    closedTitle: {
        ...typography.h2,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        textAlign: "center",
    },
    closedSubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },

    pillWrapper: {
        backgroundColor: colors.primary,
        padding: spacing.sm,
    },
    mealSwitcherContainer: {
        flexDirection: "row",
        borderRadius: spacing.sm,
        overflow: "hidden",
    },
    mealSwitcherBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: "center",
        justifyContent: "center",
    },
    mealSwitcherBtnActive: {
        backgroundColor: colors.accent,
    },
    mealSwitcherTxt: {
        ...typography.body,
        color: colors.surface,
    },
    mealSwitcherTxtActive: {
        ...typography.body,
        color: colors.surface,
        fontWeight: "700",
    },
    mealSwitcherBtnUnselected: {
        backgroundColor: `${colors.background}33`,
    },
    mealSwitcherTxtUnselected: {
        ...typography.body,
        color: colors.background,
    },

    body: {
        flex: 1,
    },
    sectionContainer: {
        padding: spacing.sm,
    },
    sectionHeader: {
        ...typography.h2,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.md,
    },

    categoryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: spacing.md,
        backgroundColor: colors.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.surface,
    },
    categoryTitle: {
        ...typography.button,
        color: colors.textPrimary,
    },
    arrow: {
        ...typography.body,
        color: colors.textSecondary,
    },

    itemsContainer: {
        paddingLeft: spacing.md,
        backgroundColor: colors.surface,
    },
    itemRow: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
    },
    itemText: {
        ...typography.body,
        color: colors.textPrimary,
    },
    noItemsText: {
        ...typography.body,
        fontStyle: "italic",
        color: colors.textSecondary,
        padding: spacing.md,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.primary,
    },
    loadingText: {
        ...typography.body,
        color: colors.background,
        marginTop: spacing.sm,
    },
    errorText: {
        ...typography.body,
        color: colors.error,
        textAlign: "center",
        padding: spacing.md,
    },
    floatingButton: {
        position: "absolute",
        bottom: spacing.lg,
        right: spacing.lg,
        backgroundColor: colors.accent,
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        ...shadows.heavy,
        zIndex: 1000,
    },
    modalStyle: {
        justifyContent: "flex-end",
        margin: 0,
    },
    overlay: {
        backgroundColor: colors.background,
        padding: spacing.md,
        height: "55%",
        borderTopLeftRadius: radii.md,
        borderTopRightRadius: radii.md,
    },
    searchBar: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.accent,
        borderRadius: radii.sm,
        padding: spacing.sm,
        marginBottom: spacing.md,
        color: colors.textPrimary,
    },
    macroHeader: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderTopLeftRadius: radii.md,
        borderTopRightRadius: radii.md,
    },
    macroHeading: {
        ...typography.h2,
        color: colors.accent,
        marginBottom: spacing.xs,
        textAlign: "center",
    },
    macroLine: {
        ...typography.body,
        color: colors.background,
        textAlign: "center",
        marginBottom: spacing.xs,
    },
});
