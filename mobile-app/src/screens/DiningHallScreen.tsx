import React, { useState, useEffect, useRef } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    Animated,
    TextInput,
    Keyboard,
    Platform,
    KeyboardAvoidingView,
    Easing,
    AppState,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

// Icon set
import { Ionicons } from "@expo/vector-icons";

// Screen specific types, constants, and themes
import type {
    MenuItem,
    ConsolidatedMenu,
    RootStackParamList,
    PlateItem,
    Day,
} from "../components/types";
import {
    CONSOLIDATED_URL,
    SECTION_DEFINITIONS,
    MEAL_ORDER,
    HALL_SCHEDULES,
} from "../components/constants";
import {
    colors,
    spacing,
    typography,
    radii,
    shadows,
    sharedStyles,
} from "../components/themes";

// Statsig import for analytics
import { useAnalytics } from "../components/statsig";

// Define navigation prop type specific to this screen
type Props = NativeStackScreenProps<RootStackParamList, "DiningHall">;

// Determines which meal (e.g., Breakfast, Lunch) is active based on time of day
export function pickCurrentMeal(
    hallObj: Record<
        string,
        { available: boolean; categories: Record<string, any> }
    >,
    hallName: string
): string {
    const now = new Date();
    const hr = now.getHours() + now.getMinutes() / 60;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        now.getDay()
    ] as Day;

    const schedule = HALL_SCHEDULES[hallName]?.[day];
    if (!schedule) {
        // Fallback: first available meal in order
        for (const meal of MEAL_ORDER) {
            if (hallObj[meal]?.available) return meal;
        }
        return "Lunch";
    }

    // Find all meals valid at this time
    const candidates = Object.entries(schedule)
        .filter(([_, window]) => hr >= window.start && hr < window.end)
        .map(([meal]) => meal);

    for (const meal of candidates) {
        if (hallObj[meal]?.available) return meal;
    }

    // Fallback: first available meal in preferred order
    for (const meal of MEAL_ORDER) {
        if (hallObj[meal]?.available) return meal;
    }

    // Fallback: Lunch
    return "Lunch";
}

// Main dining hall screen
export default function DiningHallScreen({ route, navigation }: Props) {
    // Route params
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
    const [selectedItems, setSelectedItems] = useState<PlateItem[]>([]);
    const [panelExpanded, setPanelExpanded] = useState(false);
    const [keyboardOffset, setKeyboardOffset] = useState(0);

    // Animated references for panel height and keyboard
    const COLLAPSED_HEIGHT = 112;
    const EXPANDED_HEIGHT = 320;
    const panelHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current; // collapsed height
    const keyboardHeight = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();
    const bottomMargin =
        Platform.OS === "ios"
            ? Animated.subtract(panelHeight, insets.bottom)
            : Animated.add(panelHeight, keyboardHeight);

    // Analytics hooks and utilities
    const { pageViewed, itemRemoved, servingSizeChanged, finalPlate } =
        useAnalytics();
    const appState = React.useRef(AppState.currentState);
    const plateLogged = useRef(false);
    const latestItems = useRef<PlateItem[]>([]);
    useEffect(() => {
        latestItems.current = selectedItems;
    });
    const logPlateOnce = () => {
        if (plateLogged.current || !latestItems.current.length) return;
        finalPlate(
            hallName,
            currentMeal,
            summarizePlate(latestItems.current),
            computeMacros(latestItems.current)
        );
        plateLogged.current = true;
    };
    const computeMacros = (items: PlateItem[]) =>
        items.reduce(
            (tot, it) => {
                const s =
                    typeof it.servings === "number"
                        ? it.servings
                        : parseFloat(it.servings) || 0;

                const num = (x: any) =>
                    typeof x === "number"
                        ? x
                        : typeof x === "string" && x.trim().startsWith("<")
                        ? 0.5
                        : parseFloat(x) || 0;

                return {
                    calories: tot.calories + s * num(it.nutrition.calories),
                    protein: tot.protein + s * num(it.nutrition.protein),
                    carbs: tot.carbs + s * num(it.nutrition.total_carbohydrate),
                    fat: tot.fat + s * num(it.nutrition.total_fat),
                };
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
    const summarizePlate = (items: PlateItem[]) =>
        items.map((i) => ({
            name: i.name,
            servings:
                typeof i.servings === "number"
                    ? i.servings
                    : parseFloat(i.servings) || 0,
        }));
    useFocusEffect(
        React.useCallback(() => {
            plateLogged.current = false; // reset when screen gains focus
            return () => logPlateOnce(); // fire once on blur
        }, [hallName, currentMeal]) // ← plate changes no longer re‑fire
    );
    useEffect(() => {
        const sub = AppState.addEventListener("change", (next) => {
            if (appState.current === "active" && next === "background") {
                logPlateOnce(); // same single‑shot helper
            }
            appState.current = next;
        });
        return () => sub.remove();
    }, [hallName, currentMeal]); // ← removed selectedItems

    // Adjust panel position based on keyboard visibility
    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow",
            (e) => {
                const height = e.endCoordinates.height;
                setKeyboardOffset(height);
                Animated.timing(keyboardHeight, {
                    toValue: height,
                    duration: e.duration || 150,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: false,
                }).start();
            }
        );

        const hideSub = Keyboard.addListener(
            Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide",
            (e) => {
                setKeyboardOffset(0);
                Animated.timing(keyboardHeight, {
                    toValue: 0,
                    duration: e.duration || 150,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: false,
                }).start();
            }
        );

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Fetch consolidate_menu.json data for this hall
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

    // Select default meal and initialize expanded categories
    useEffect(() => {
        if (!diningHalls) return;
        const hallObj = diningHalls[hallId];
        if (!hallObj) {
            setLoadError(`No data for "${hallId}"`);
            return;
        }
        if (!currentMeal) setCurrentMeal(pickCurrentMeal(hallObj, hallName));
        const cats = Object.keys(hallObj[currentMeal]?.categories || {});
        setExpanded(
            cats.reduce(
                (p, n) => ({ ...p, [n]: false }),
                {} as Record<string, boolean>
            )
        );
    }, [diningHalls, currentMeal, hallId]);

    // Log page view
    useEffect(() => {
        if (currentMeal) {
            pageViewed("DiningHall", { hallName, meal: currentMeal });
        }
    }, [hallName, currentMeal]);

    // Parses nutrition number strings (e.g., "<5")
    const parseNumber = (x: any) => {
        if (typeof x === "number") return x;
        if (typeof x === "string") {
            const trimmed = x.trim();
            if (trimmed.startsWith("<")) return 0.5;
            const parsed = parseFloat(trimmed);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    // Toggles the MyPlate panel
    const togglePanel = () => {
        Animated.timing(panelHeight, {
            toValue: panelExpanded ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
            duration: 300,
            useNativeDriver: false,
        }).start();
        setPanelExpanded((p) => !p);
    };

    // Calculate total macros based on selected items and servings
    const totalMacros = selectedItems.reduce(
        (totals, item) => {
            const s =
                typeof item.servings === "number"
                    ? item.servings
                    : parseFloat(item.servings) || 0;

            return {
                calories:
                    totals.calories + s * parseNumber(item.nutrition.calories),
                protein:
                    totals.protein + s * parseNumber(item.nutrition.protein),
                carbs:
                    totals.carbs +
                    s * parseNumber(item.nutrition.total_carbohydrate),
                fat: totals.fat + s * parseNumber(item.nutrition.total_fat),
            };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 } // initial accumulator
    );

    // Show loading spinner if data is being fetched
    if (loading) {
        return (
            <SafeAreaView style={sharedStyles.screenSurface}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Loading menu…</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Display error if loading failed
    if (loadError) {
        return (
            <SafeAreaView style={sharedStyles.screenSurface}>
                <Text style={sharedStyles.errorText}>{loadError}</Text>
            </SafeAreaView>
        );
    }

    // Fallback if no dining hall data exists
    if (!diningHalls) {
        return (
            <SafeAreaView style={sharedStyles.screenSurface}>
                <Text style={sharedStyles.errorText}>
                    No dining hall data available
                </Text>
            </SafeAreaView>
        );
    }

    // Handle case where provided hallId is invalid
    const hallObj = diningHalls[hallId];
    if (!hallObj) {
        return (
            <SafeAreaView style={sharedStyles.screenSurface}>
                <Text style={sharedStyles.errorText}>
                    No data for "{hallId}"
                </Text>
            </SafeAreaView>
        );
    }

    // Get valid meals in preferred order
    const rawMealKeys = Object.keys(hallObj);
    const mealKeys = MEAL_ORDER.filter((m) => rawMealKeys.includes(m));
    const anyMealOpen = mealKeys.some((meal) => hallObj[meal]?.available);

    // If no meals are open today, show "closed" message
    if (!anyMealOpen) {
        return (
            <SafeAreaView style={sharedStyles.screenSurface}>
                <View style={styles.header}>
                    <Text style={styles.hallName}>{hallName}</Text>
                </View>
                <View style={styles.closedContainer}>
                    <Text style={styles.closedTitle}>
                        {hallName} is closed today.
                    </Text>
                    <Text style={sharedStyles.textSecondary}>
                        Check back tomorrow or try another dining hall.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Gather all categories for the current meal
    const allCategories = Object.keys(hallObj[currentMeal]?.categories || {});

    // Organize categories into pre-defined sections, otherwise classify as "Other"
    const sectionMap: Record<string, string[]> = {};
    SECTION_DEFINITIONS.forEach((d) => (sectionMap[d.title] = []));
    const other: string[] = [];

    allCategories.forEach((cat) => {
        const def = SECTION_DEFINITIONS.find((d) => d.match(cat));
        def ? sectionMap[def.title].push(cat) : other.push(cat);
    });

    // Render Dining Hall Screen
    return (
        <SafeAreaView style={sharedStyles.screenSurface}>
            {/* Header with Hall name and "Plan My Plate" button */}
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
                    <Text style={sharedStyles.buttonTextLight}>
                        Plan My Plate
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Meal period selector (Breakfast / Lunch / Dinner) */}
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
                                    sharedStyles.text,
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

            {/* Scrollable list of categorized food sections */}
            <Animated.ScrollView
                style={{ flex: 1, marginBottom: bottomMargin }}
                contentContainerStyle={{ paddingTop: spacing.sm }}
            >
                {/* Predefined sections */}
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

                {/* "Other" section for uncategorized items */}
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
            </Animated.ScrollView>

            {/* MyPlate panel at bottom for selected items + macros summary */}
            <Animated.View
                style={[
                    styles.panelContainer,
                    {
                        height: panelHeight,
                        bottom: keyboardHeight,
                    },
                ]}
            >
                {/* Panel header with toggle + macros */}
                <TouchableOpacity
                    style={styles.panelHeader}
                    onPress={togglePanel}
                    activeOpacity={0.8}
                >
                    <View style={styles.togglePill}>
                        <Ionicons
                            name={panelExpanded ? "chevron-down" : "chevron-up"}
                            size={28}
                            color={colors.background}
                        />
                    </View>

                    <View style={styles.macroGridContainer}>
                        <View style={styles.gridBubble}>
                            <Text style={styles.bubbleText}>
                                {totalMacros.calories.toFixed(1)} kcal
                            </Text>
                        </View>
                        <View style={styles.gridBubble}>
                            <Text style={styles.bubbleText}>
                                {totalMacros.protein.toFixed(1)}g Protein
                            </Text>
                        </View>
                        <View style={styles.gridBubble}>
                            <Text style={styles.bubbleText}>
                                {totalMacros.carbs.toFixed(1)}g Carbs
                            </Text>
                        </View>
                        <View style={styles.gridBubble}>
                            <Text style={styles.bubbleText}>
                                {totalMacros.fat.toFixed(1)}g Fat
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Panel body: list of selected items with serving controls */}
                {panelExpanded && (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : undefined}
                        style={{ flex: 1 }}
                    >
                        <ScrollView
                            style={styles.panelBody}
                            contentContainerStyle={{
                                paddingBottom: spacing.xxl,
                            }}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="none"
                        >
                            {selectedItems.length === 0 ? (
                                <Text style={styles.noItemsText}>
                                    Your plate is empty. Tap the "+" to add food
                                    here!
                                </Text>
                            ) : (
                                selectedItems.map((item) => (
                                    <View
                                        key={item.name}
                                        style={styles.itemRow}
                                    >
                                        {/* Left side: Servings + Item Name */}
                                        <TouchableOpacity
                                            onPress={() =>
                                                navigation.navigate(
                                                    "ItemDetail",
                                                    {
                                                        hallId,
                                                        mealPeriod: currentMeal,
                                                        categoryId:
                                                            item.categoryId,
                                                        itemDetail: item,
                                                    }
                                                )
                                            }
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                flex: 1,
                                            }}
                                            hitSlop={{
                                                top: 4,
                                                bottom: 4,
                                                left: 4,
                                                right: 4,
                                            }}
                                        >
                                            <TextInput
                                                style={[
                                                    sharedStyles.input,
                                                    {
                                                        width: 50,
                                                        height: 30,
                                                        textAlign: "center",
                                                        marginRight: 8,
                                                    },
                                                ]}
                                                hitSlop={{
                                                    top: 32,
                                                    bottom: 32,
                                                    left: 32,
                                                    right: 32,
                                                }}
                                                keyboardType={
                                                    Platform.OS === "ios"
                                                        ? "decimal-pad"
                                                        : "numeric"
                                                }
                                                inputMode="decimal"
                                                value={item.servings.toString()}
                                                onChangeText={(text) => {
                                                    // allow empty so user can delete
                                                    if (text === "") {
                                                        setSelectedItems(
                                                            (prev) =>
                                                                prev.map((i) =>
                                                                    i.name ===
                                                                    item.name
                                                                        ? {
                                                                              ...i,
                                                                              servings:
                                                                                  text,
                                                                          }
                                                                        : i
                                                                )
                                                        );
                                                        return;
                                                    }

                                                    // up to two digits before dot, optional dot + exactly one digit
                                                    const regex =
                                                        /^\d{1,2}(?:\.\d?)?$/;
                                                    if (
                                                        regex.test(text) &&
                                                        parseFloat(text) <= 99
                                                    ) {
                                                        setSelectedItems(
                                                            (prev) =>
                                                                prev.map((i) =>
                                                                    i.name ===
                                                                    item.name
                                                                        ? {
                                                                              ...i,
                                                                              servings:
                                                                                  text,
                                                                          }
                                                                        : i
                                                                )
                                                        );
                                                    }
                                                }}
                                                onEndEditing={({
                                                    nativeEvent,
                                                }) => {
                                                    let v = parseFloat(
                                                        nativeEvent.text ??
                                                            item.servings.toString()
                                                    );
                                                    if (isNaN(v) || v < 1)
                                                        v = 1;
                                                    if (v > 99) v = 99;
                                                    setSelectedItems((prev) =>
                                                        prev.map((i) =>
                                                            i.name === item.name
                                                                ? {
                                                                      ...i,
                                                                      servings:
                                                                          v,
                                                                  }
                                                                : i
                                                        )
                                                    );
                                                    servingSizeChanged(
                                                        item.name,
                                                        v,
                                                        hallId,
                                                        currentMeal
                                                    );
                                                }}
                                            />
                                            <Text
                                                style={[
                                                    sharedStyles.textBackground,
                                                    {
                                                        flexShrink: 1,
                                                        flexWrap: "wrap",
                                                    },
                                                ]}
                                            >
                                                {item.name}
                                            </Text>
                                        </TouchableOpacity>
                                        {/* Right side: Remove button */}
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedItems((prev) =>
                                                    prev.filter(
                                                        (i) =>
                                                            i.name !== item.name
                                                    )
                                                );
                                                itemRemoved(
                                                    item.name,
                                                    hallId,
                                                    currentMeal,
                                                    "My Plate menu"
                                                );
                                            }}
                                            hitSlop={{
                                                top: 10,
                                                bottom: 10,
                                                left: 10,
                                                right: 10,
                                            }}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                marginLeft: spacing.sm,
                                            }}
                                        >
                                            <Text style={styles.itemRemoveText}>
                                                Remove
                                            </Text>
                                            <Ionicons
                                                name="close"
                                                size={20}
                                                color={colors.error}
                                                style={{ marginLeft: 6 }}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </KeyboardAvoidingView>
                )}
            </Animated.View>
        </SafeAreaView>
    );
}

// Component for rendering a category block of food items
function CategoryBlock({
    category, // category name (e.g., "Homestyle")
    items, // array of MenuItem objects
    expanded, // whether this block is currently expanded or collapsed
    onToggle, // function to toggle expanded state
    navigation, // navigation object for screen routing
    hallId, // current dining hall ID
    meal, // current meal period (e.g., "Lunch")
    selectedItems, // array of currently selected plate items
    setSelectedItems, // setter to update selected plate items
}: {
    category: string;
    items: MenuItem[];
    expanded: boolean;
    onToggle(): void;
    navigation: any;
    hallId: string;
    meal: string;
    selectedItems: PlateItem[];
    setSelectedItems: React.Dispatch<React.SetStateAction<PlateItem[]>>;
}) {
    const { itemAdded, itemRemoved } = useAnalytics();
    return (
        <View>
            {/* Tappable category header row (toggles expansion) */}
            <TouchableOpacity
                style={styles.categoryHeader}
                onPress={onToggle}
                activeOpacity={0.7}
            >
                {/* Category title on left */}
                <Text style={sharedStyles.buttonTextDark}>{category}</Text>
                {/* Expand/collapse arrow on right */}
                <Text style={styles.arrow}>{expanded ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {/* If expanded, show list of items */}
            {expanded && (
                <View style={styles.itemsContainer}>
                    {/* Handle empty categories */}
                    {items.length === 0 ? (
                        <Text style={styles.noItemsText}>(No items)</Text>
                    ) : (
                        // Render each item
                        items.map((item, i) => {
                            // Check if item is already selected
                            const isSelected = selectedItems.some(
                                (x) => x.name === item.name
                            );
                            return (
                                <View
                                    key={`${category}-${i}`}
                                    style={[
                                        styles.itemRow,
                                        // Highlight background if selected
                                        isSelected && {
                                            backgroundColor:
                                                colors.accent + "22",
                                        },
                                    ]}
                                >
                                    {/* LEFT: Item name (tap to view details) */}
                                    <TouchableOpacity
                                        onPress={() =>
                                            navigation.navigate("ItemDetail", {
                                                hallId,
                                                mealPeriod: meal,
                                                categoryId: category,
                                                itemDetail: item,
                                            })
                                        }
                                        hitSlop={{
                                            top: 16,
                                            bottom: 16,
                                            left: 16,
                                            right: 16,
                                        }}
                                        style={{ flex: 1 }}
                                    >
                                        <Text
                                            style={[
                                                isSelected && {
                                                    color: colors.accent,
                                                },
                                            ]}
                                        >
                                            {item.name}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* RIGHT: + / − button to toggle selection */}
                                    <TouchableOpacity
                                        onPress={() => {
                                            setSelectedItems((prev) => {
                                                const wasSelected = prev.some(
                                                    (x) => x.name === item.name
                                                );

                                                if (wasSelected) {
                                                    itemRemoved(
                                                        item.name,
                                                        hallId,
                                                        meal,
                                                        "Category list"
                                                    );
                                                    return prev.filter(
                                                        (x) =>
                                                            x.name !== item.name
                                                    );
                                                } else {
                                                    itemAdded(
                                                        item.name,
                                                        hallId,
                                                        meal
                                                    );
                                                    return [
                                                        ...prev,
                                                        {
                                                            ...item,
                                                            servings: 1,
                                                        },
                                                    ];
                                                }
                                            });
                                        }}
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
                                            <Ionicons
                                                name={
                                                    isSelected
                                                        ? "remove-circle-outline"
                                                        : "add-circle-outline"
                                                }
                                                size={24}
                                                color={
                                                    isSelected
                                                        ? colors.error
                                                        : colors.accent
                                                }
                                            />
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
    // Header styles
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

    // Closed dining hall message styles
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

    // Meal switcher styles
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
    mealSwitcherTxtActive: {
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

    // Section / category styles
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
    arrow: {
        ...typography.body,
        color: colors.textSecondary,
    },
    itemsContainer: {
        paddingLeft: spacing.md,
        backgroundColor: colors.surface,
    },

    // Item row styles
    itemRow: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.surface,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    noItemsText: {
        ...typography.body,
        fontStyle: "italic",
        color: colors.textSecondary,
        padding: spacing.md,
    },

    // Loading indicator
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

    // MyPlate panel styles
    panelContainer: {
        backgroundColor: colors.primary,
        bottom: 0,
        position: "absolute",
        left: 0,
        right: 0,
        borderTopLeftRadius: radii.lg,
        borderTopRightRadius: radii.lg,
        overflow: "hidden",
        ...shadows.heavy,
    },
    panelBody: {
        padding: spacing.sm,
    },
    itemRemoveText: {
        ...typography.button,
        color: colors.error,
    },
    bubbleText: {
        ...typography.button,
        color: colors.background,
    },
    panelHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: spacing.md,
        paddingBottom: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.background,
    },
    macroGridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-around",
        flex: 1,
        marginLeft: spacing.sm,
    },
    gridBubble: {
        flexBasis: "45%",
        backgroundColor: colors.accent,
        padding: spacing.xs,
        borderRadius: radii.md,
        alignItems: "center",
        marginBottom: spacing.xs,
    },
    togglePill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: `${colors.background}33`,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
    },
});
