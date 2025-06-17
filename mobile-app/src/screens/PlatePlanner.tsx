import React, { useState } from "react";
import {
    SafeAreaView,
    ScrollView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StyleSheet,
    Switch,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ALLERGENS } from "../components/constants";
import type { RootStackParamList } from "../components/types";
import {
    colors,
    spacing,
    typography,
    radii,
    shadows,
} from "../components/themes";

// Define props type for this screen
type Props = NativeStackScreenProps<RootStackParamList, "PlatePlanner">;

// Response shape from the planning API
interface ApiItem {
    category: string;
    name: string;
    servings: number;
}
interface ApiResponse {
    items: ApiItem[];
    totals: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
}

export default function PlatePlanner({ route }: Props) {
    const { hallName, mealPeriod } = route.params;

    // Macro target inputs
    const [calorieTarget, setCalorieTarget] = useState<string>("");
    const [proteinTarget, setProteinTarget] = useState<string>("");
    const [carbTarget, setCarbTarget] = useState<string>("");
    const [fatTarget, setFatTarget] = useState<string>("");
    const [avoidedAllergies, setAvoidedAllergies] = useState<string[]>([]);

    // Loading, result, and error states
    const [loading, setLoading] = useState<boolean>(false);
    const [result, setResult] = useState<ApiResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Macro input definitions for mapping
    const macroFields: [string, string, (v: string) => void][] = [
        ["Calories", calorieTarget, setCalorieTarget],
        ["Protein", proteinTarget, setProteinTarget],
        ["Carbs", carbTarget, setCarbTarget],
        ["Fat", fatTarget, setFatTarget],
    ];

    async function onPlanPlatePress() {
        const cals = calorieTarget ? parseInt(calorieTarget, 10) : undefined;
        const prot = proteinTarget ? parseInt(proteinTarget, 10) : undefined;
        const carbs = carbTarget ? parseInt(carbTarget, 10) : undefined;
        const fat = fatTarget ? parseInt(fatTarget, 10) : undefined;

        if (
            (cals !== undefined && isNaN(cals)) ||
            (prot !== undefined && isNaN(prot)) ||
            (carbs !== undefined && isNaN(carbs)) ||
            (fat !== undefined && isNaN(fat))
        ) {
            Alert.alert(
                "Invalid Input",
                "Please enter valid numeric values or leave blank."
            );
            return;
        }
        if ([cals, prot, carbs, fat].every((v) => v === undefined)) {
            Alert.alert(
                "No Targets",
                "Please specify at least one macro target."
            );
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const payload = {
                hall: hallName,
                meal: mealPeriod,
                calorieTarget: cals,
                proteinTarget: prot,
                carbTarget: carbs,
                fatTarget: fat,
                avoidAllergies: avoidedAllergies,
            };
            const response = await fetch(
                "https://uycl10fz1j.execute-api.us-east-2.amazonaws.com/dev/plan-plate",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Error ${response.status}: ${text}`);
            }
            const json: ApiResponse = await response.json();
            setResult(json);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Fixed Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{hallName}</Text>
                <Text style={styles.headerSubtitle}>{mealPeriod}</Text>
            </View>

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.controls}>
                    <Text style={styles.sectionHeaderText}>
                        Set Macro Targets
                    </Text>
                    <View style={styles.macroCard}>
                        {macroFields.map(([label, value, setter]) => (
                            <View key={label} style={styles.inputRow}>
                                <Text style={styles.inputLabel}>{label}</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    placeholder="--"
                                    placeholderTextColor={colors.textSecondary}
                                    value={value}
                                    onChangeText={setter}
                                />
                            </View>
                        ))}
                    </View>

                    <View style={styles.allergySection}>
                        <Text style={styles.sectionHeaderText}>
                            Avoid Allergens
                        </Text>
                        <View style={styles.allergyOptions}>
                            {ALLERGENS.map((allergy) => {
                                const isOn = avoidedAllergies.includes(allergy);
                                return (
                                    <View
                                        key={allergy}
                                        style={styles.switchContainer}
                                    >
                                        <Switch
                                            value={isOn}
                                            onValueChange={(val) =>
                                                setAvoidedAllergies((prev) =>
                                                    val
                                                        ? [...prev, allergy]
                                                        : prev.filter(
                                                              (a) =>
                                                                  a !== allergy
                                                          )
                                                )
                                            }
                                            trackColor={{
                                                true: colors.primary,
                                                false: colors.surface,
                                            }}
                                            thumbColor={
                                                isOn
                                                    ? colors.accent
                                                    : colors.background
                                            }
                                            style={styles.switch}
                                        />
                                        <Text style={styles.switchLabel}>
                                            {allergy}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={onPlanPlatePress}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : (
                            <Text style={styles.buttonText}>Plan Plate</Text>
                        )}
                    </TouchableOpacity>

                    {error && <Text style={styles.errorText}>{error}</Text>}
                </View>

                {result && (
                    <View style={styles.resultSection}>
                        <Text style={styles.sectionHeaderText}>Your Plate</Text>
                        {result.items.map((item, idx) => {
                            const raw = `${item.category}|${item.name}`;
                            const parts = raw.split("|");
                            const displayCategory = parts[3];
                            const displayName = parts[4];
                            return (
                                <View key={idx} style={styles.comboCard}>
                                    <Text style={styles.comboText}>
                                        {displayCategory} {"->"} {displayName}
                                    </Text>
                                </View>
                            );
                        })}
                        <View style={styles.totalsCard}>
                            <Text style={styles.sectionHeaderText}>
                                Total Macros
                            </Text>
                            <View style={styles.totalsContainer}>
                                <Text style={styles.totalsText}>
                                    Calories: {result.totals.calories} kcal
                                </Text>
                                <Text style={styles.totalsText}>
                                    Protein: {result.totals.protein} g
                                </Text>
                                <Text style={styles.totalsText}>
                                    Carbs: {result.totals.carbs} g
                                </Text>
                                <Text style={styles.totalsText}>
                                    Fat: {result.totals.fat} g
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    header: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
    },
    headerTitle: {
        ...typography.h1,
        color: colors.surface,
    },
    headerSubtitle: {
        ...typography.body,
        color: colors.surface,
        marginTop: spacing.xs,
    },
    scrollView: {
        backgroundColor: colors.surface,
        flex: 1,
    },
    contentContainer: {
        paddingBottom: spacing.lg,
    },
    controls: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
    macroCard: {
        backgroundColor: colors.background,
        borderRadius: radii.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    inputLabel: {
        flex: 1,
        ...typography.button,
        color: colors.textPrimary,
    },
    input: {
        flex: 1,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.accent,
        borderRadius: radii.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        color: colors.textPrimary,
    },
    allergySection: {
        marginBottom: spacing.md,
    },
    allergyOptions: {
        flexDirection: "row",
        flexWrap: "wrap",
        backgroundColor: colors.background,
        borderRadius: radii.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    switchContainer: {
        width: "50%",
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.xs,
    },
    switch: {
        transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
    },
    switchLabel: {
        ...typography.body,
        color: colors.textPrimary,
        marginLeft: spacing.xs,
    },
    button: {
        backgroundColor: colors.accent,
        padding: spacing.sm,
        borderRadius: radii.sm,
        alignItems: "center",
        marginBottom: spacing.md,
    },
    buttonText: {
        ...typography.button,
        color: colors.surface,
    },
    errorText: {
        ...typography.body,
        color: colors.error,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    resultSection: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
    sectionHeaderText: {
        ...typography.h2,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    comboCard: {
        backgroundColor: colors.background,
        borderRadius: radii.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...shadows.card,
    },
    comboText: {
        ...typography.body,
        color: colors.textPrimary,
    },
    totalsCard: {
        marginTop: spacing.md,
    },
    totalsContainer: {
        backgroundColor: colors.background,
        borderRadius: radii.md,
        padding: spacing.md,
        ...shadows.card,
    },
    totalsText: {
        ...typography.body,
        color: colors.textPrimary,
        marginVertical: spacing.xs,
    },
});
