import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-root-toast";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type {
    MenuItem,
    ConsolidatedMenu,
    RootStackParamList,
    PlateItem,
} from "../components/types";
import {
    CONSOLIDATED_URL,
    SECTION_DEFINITIONS,
    MEAL_ORDER,
} from "../components/constants";
import {
    colors,
    spacing,
    typography,
    radii,
    shadows,
    sharedStyles,
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
    const start = MEAL_ORDER.indexOf(tentative);
    if (start === -1) return MEAL_ORDER[0];
    for (let i = 0; i < MEAL_ORDER.length; i++) {
        const meal = MEAL_ORDER[(start + i) % MEAL_ORDER.length];
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
    const [selectedItems, setSelectedItems] = useState<PlateItem[]>([]);
    const [panelExpanded, setPanelExpanded] = useState(false);
    const panelHeight = useRef(new Animated.Value(90)).current; // collapsed height
    const keyboardHeight = useRef(new Animated.Value(0)).current;

    // Animate keyboard animation
    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardWillShow", (e) => {
            Animated.timing(keyboardHeight, {
                toValue: e.endCoordinates.height,
                duration: e.duration || 250,
                useNativeDriver: false,
            }).start();
        });

        const hideSub = Keyboard.addListener("keyboardWillHide", (e) => {
            Animated.timing(keyboardHeight, {
                toValue: 0,
                duration: e.duration || 250,
                useNativeDriver: false,
            }).start();
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

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

    // Helper for number parsing
    const parseNumber = (x: any) => {
        if (typeof x === "number") return x;
        if (typeof x === "string") {
            const trimmed = x.trim();
            if (trimmed.startsWith("<")) return 0.5; // or 0.25 or 0 depending on how conservative you want to be
            const parsed = parseFloat(trimmed);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    // Helper to toggel MyPlate panel
    const togglePanel = () => {
        Animated.timing(panelHeight, {
            toValue: panelExpanded ? 80 : 300,
            duration: 300,
            useNativeDriver: false,
        }).start();
        setPanelExpanded((p) => !p);
    };

    // Calculate macros
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
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    // Handle loading state
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

    // Handle error state
    if (loadError) {
        return (
            <SafeAreaView style={sharedStyles.screenSurface}>
                <Text style={sharedStyles.errorText}>{loadError}</Text>
            </SafeAreaView>
        );
    }

    // Handle null diningHalls
    if (!diningHalls) {
        return (
            <SafeAreaView style={sharedStyles.screenSurface}>
                <Text style={sharedStyles.errorText}>
                    No dining hall data available
                </Text>
            </SafeAreaView>
        );
    }

    // Handle invalid hallId
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

    // Handle case where no meals are available
    const rawMealKeys = Object.keys(hallObj);
    const mealKeys = MEAL_ORDER.filter((m) => rawMealKeys.includes(m));
    const anyMealOpen = mealKeys.some((meal) => hallObj[meal]?.available);
    if (!anyMealOpen) {
        return (
            <SafeAreaView style={sharedStyles.screenSurface}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.hallName}>{hallName}</Text>
                </View>

                {/* Closed-Today Message */}
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
        <SafeAreaView style={sharedStyles.screenSurface}>
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
                    <Text style={sharedStyles.buttonTextLight}>
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

            {/* Sections */}
            <ScrollView
                contentContainerStyle={{
                    paddingTop: spacing.sm,
                    paddingBottom: spacing.xxl + 8,
                }}
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
            <Animated.View
                style={[
                    styles.panelContainer,
                    {
                        height: panelHeight,
                        transform: [
                            {
                                translateY: Animated.add(
                                    panelExpanded
                                        ? Animated.multiply(keyboardHeight, -1)
                                        : new Animated.Value(0),
                                    new Animated.Value(0) // optional vertical offset
                                ),
                            },
                        ],
                    },
                ]}
            >
                <TouchableOpacity
                    style={styles.panelHeader}
                    onPress={togglePanel}
                    activeOpacity={0.8}
                >
                    <Text style={styles.panelToggleText}>
                        {panelExpanded ? "Hide My Plate ▼" : "Show My Plate ▲"}
                    </Text>
                    <Text style={styles.macroSummaryText}>
                        Calories: {totalMacros.calories} kcal | Protein:{" "}
                        {totalMacros.protein}g | Carbs: {totalMacros.carbs}g |
                        Fat: {totalMacros.fat}g
                    </Text>
                </TouchableOpacity>
                {panelExpanded && (
                    <ScrollView
                        style={styles.panelBody}
                        keyboardShouldPersistTaps="handled"
                    >
                        {selectedItems.length === 0 ? (
                            <Text style={styles.noItemsText}>
                                Your plate is empty. Tap the "+" to add food
                                here!
                            </Text>
                        ) : (
                            selectedItems.map((item) => (
                                <View key={item.name} style={styles.itemRow}>
                                    {/* Left side: Servings + Item Name */}
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            flex: 1,
                                        }}
                                    >
                                        <TextInput
                                            style={[
                                                sharedStyles.input,
                                                {
                                                    width: 40,
                                                    height: 30,
                                                    textAlign: "center",
                                                    marginRight: 8,
                                                },
                                            ]}
                                            keyboardType="numeric"
                                            value={item.servings.toString()}
                                            onChangeText={(text) => {
                                                if (text === "") {
                                                    setSelectedItems((prev) =>
                                                        prev.map((i) =>
                                                            i.name === item.name
                                                                ? {
                                                                      ...i,
                                                                      servings:
                                                                          "" as any,
                                                                  }
                                                                : i
                                                        )
                                                    );
                                                } else {
                                                    const newVal =
                                                        parseFloat(text);
                                                    if (
                                                        !isNaN(newVal) &&
                                                        newVal > 0
                                                    ) {
                                                        setSelectedItems(
                                                            (prev) =>
                                                                prev.map((i) =>
                                                                    i.name ===
                                                                    item.name
                                                                        ? {
                                                                              ...i,
                                                                              servings:
                                                                                  newVal,
                                                                          }
                                                                        : i
                                                                )
                                                        );
                                                    }
                                                }
                                            }}
                                            onBlur={() => {
                                                setSelectedItems((prev) =>
                                                    prev.map((i) =>
                                                        i.name === item.name
                                                            ? {
                                                                  ...i,
                                                                  servings:
                                                                      !i.servings ||
                                                                      isNaN(
                                                                          i.servings as any
                                                                      )
                                                                          ? 1
                                                                          : i.servings,
                                                              }
                                                            : i
                                                    )
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
                                    </View>

                                    {/* Right side: Remove button */}
                                    <TouchableOpacity
                                        onPress={() =>
                                            setSelectedItems((prev) =>
                                                prev.filter(
                                                    (i) => i.name !== item.name
                                                )
                                            )
                                        }
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
                )}
            </Animated.View>
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
    selectedItems: PlateItem[];
    setSelectedItems: React.Dispatch<React.SetStateAction<PlateItem[]>>;
}) {
    return (
        <View>
            <TouchableOpacity
                style={styles.categoryHeader}
                onPress={onToggle}
                activeOpacity={0.7}
            >
                <Text style={sharedStyles.buttonTextDark}>{category}</Text>
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

                                    {/* Right side: + button → toggle selection */}
                                    <TouchableOpacity
                                        onPress={() => {
                                            setSelectedItems((prev) => {
                                                const newSelection = isSelected
                                                    ? prev.filter(
                                                          (x) =>
                                                              x.name !==
                                                              item.name
                                                      )
                                                    : [
                                                          ...prev,
                                                          {
                                                              ...item,
                                                              servings: 1,
                                                          },
                                                      ];

                                                if (!isSelected) {
                                                    Toast.show(
                                                        `${item.name} added to your plate`,
                                                        {
                                                            duration:
                                                                Toast.durations
                                                                    .SHORT,
                                                            position:
                                                                Toast.positions
                                                                    .TOP,
                                                            shadow: true,
                                                            animation: true,
                                                            hideOnPress: true,
                                                            backgroundColor:
                                                                colors.primary,
                                                            textColor:
                                                                colors.accent,
                                                            opacity: 0.95,
                                                            containerStyle: {
                                                                borderRadius: 8,
                                                                paddingHorizontal: 16,
                                                                paddingVertical: 12,
                                                                marginTop: 40,
                                                            },
                                                        }
                                                    );
                                                }

                                                return newSelection;
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
    panelHeader: {
        backgroundColor: colors.primary,
        padding: spacing.sm,
    },
    panelToggleText: {
        ...typography.button,
        color: colors.accent,
        textAlign: "center",
    },
    macroSummaryText: {
        ...typography.body,
        color: colors.background,
        textAlign: "center",
        marginTop: spacing.xs,
    },
    panelBody: {
        padding: spacing.sm,
    },
    itemRemoveText: {
        ...typography.button,
        color: colors.error,
    },
});
