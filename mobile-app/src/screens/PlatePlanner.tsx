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
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../components/types";
import {
    colors,
    spacing,
    typography,
    radii,
    shadows,
} from "../components/themes";

// Define props type for this screen screen
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

/**
 * PlatePlanner allows users to set macro targets and
 * generates a plate suggestion based on available items.
 */
export default function PlatePlanner({ route }: Props) {
    const { hallName, mealPeriod } = route.params;

    // Macro target inputs
    const [calorieTarget, setCalorieTarget] = useState<string>("");
    const [proteinTarget, setProteinTarget] = useState<string>("");
    const [carbTarget, setCarbTarget] = useState<string>("");
    const [fatTarget, setFatTarget] = useState<string>("");

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

    /**
     * Handles the Plan Plate button press:
     * - Validates numeric input
     * - Sends POST to API
     * - Sets result or error
     */
    async function onPlanPlatePress() {
        // Parse inputs
        const cals = calorieTarget ? parseInt(calorieTarget, 10) : undefined;
        const prot = proteinTarget ? parseInt(proteinTarget, 10) : undefined;
        const carbs = carbTarget ? parseInt(carbTarget, 10) : undefined;
        const fat = fatTarget ? parseInt(fatTarget, 10) : undefined;

        // Validate numbers
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

    // Main page render
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header title only */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{hallName}</Text>
                    <Text style={styles.headerSubtitle}>{mealPeriod}</Text>
                </View>

                {/* Input controls */}
                <View style={styles.controls}>
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

                {/* Results: simplified cards */}
                {result && (
                    <View style={styles.resultSection}>
                        <Text style={styles.sectionHeaderText}>Your Plate</Text>

                        {result.items.map((item, idx) => {
                            // Split and format returned items from API
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

                        {/* Totals card */}
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
        padding: spacing.md,
    },
    headerTitle: {
        ...typography.h1,
        color: colors.textPrimary,
    },
    headerSubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },

    controls: {
        padding: spacing.md,
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

    button: {
        backgroundColor: colors.accent,
        padding: spacing.sm,
        borderRadius: radii.sm,
        alignItems: "center",
        marginTop: spacing.sm,
    },
    buttonText: {
        ...typography.button,
        color: colors.surface,
    },
    errorText: {
        ...typography.body,
        color: colors.error,
        textAlign: "center",
        marginTop: spacing.sm,
    },

    // Results styling
    resultSection: {
        padding: spacing.md,
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
        backgroundColor: colors.background,
        borderRadius: radii.md,
        padding: spacing.md,
        marginTop: spacing.md,
        ...shadows.card,
    },
    totalsContainer: {
        marginTop: spacing.sm,
    },
    totalsText: {
        ...typography.body,
        color: colors.textPrimary,
        marginVertical: spacing.xs,
    },
});
