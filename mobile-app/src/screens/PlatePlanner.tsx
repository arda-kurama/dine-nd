// File: src/screens/PlatePlanner.tsx

import React, { useState } from "react";
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Alert,
    ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/index";
import { cachedMenu } from "./DiningHallScreen";

// Import the planner utilities
import {
    PlannerMenuItem,
    Nutrition,
    generateVirtualItems,
    findPlateCombinations,
    VirtualMenuItem,
} from "../utils/PlatePlannerUtils";

type Props = NativeStackScreenProps<RootStackParamList, "PlatePlanner">;

export default function PlatePlanner({ route }: Props) {
    const { hallId, hallName, mealPeriod } = route.params;

    ///////////////////////////////
    // 1) LOCAL STATE & CONFIG   //
    ///////////////////////////////

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Macro input fields; blank means “ignore”
    const [calorieTarget, setCalorieTarget] = useState<string>("");
    const [proteinTarget, setProteinTarget] = useState<string>("");
    const [carbTarget, setCarbTarget] = useState<string>("");
    const [fatTarget, setFatTarget] = useState<string>("");

    // Store found combinations here
    const [matches, setMatches] = useState<VirtualMenuItem[][]>([]);

    ///////////////////////////////
    // 2) HELPER: GET ENTREE LIST//
    ///////////////////////////////

    function getEntreeListFromCache(): PlannerMenuItem[] {
        if (!cachedMenu) {
            throw new Error("Menu data is not loaded in cache.");
        }

        // 1) Grab the hall object
        const allHalls = (cachedMenu as any).dining_halls as {
            [key: string]: any;
        };
        const hallObj = allHalls[hallId];
        if (!hallObj) {
            throw new Error(`No data found for hallId "${hallId}".`);
        }

        // 2) Grab exactly the mealPeriod we passed in
        const periodObj = hallObj[mealPeriod];
        if (!periodObj || !periodObj.categories) {
            throw new Error(`No data for "${mealPeriod}" at ${hallName}.`);
        }

        const categories: { [key: string]: PlannerMenuItem[] } =
            periodObj.categories;

        // 3) Debug: log all category names so you can see what’s actually in the JSON
        console.warn(
            `[PlatePlanner] Available categories for ${hallName} → ${mealPeriod}:`,
            Object.keys(categories)
        );

        const entreeList: PlannerMenuItem[] = [];
        for (const catName of Object.keys(categories)) {
            // 3a) Strip accents from catName, then lowercase:
            const normalized = catName
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();

            // 3b) If normalized name contains “entree” or “main”, include those items
            if (normalized.includes("entree") || normalized.includes("main")) {
                entreeList.push(...categories[catName]);
            }
        }

        // 4) If we found nothing above, fall back to “include everything”:
        if (entreeList.length === 0) {
            console.warn(
                `[PlatePlanner] No "entree"/"main" categories matched. ` +
                    `Returning all items (${
                        Object.keys(categories).length
                    } categories).`
            );
            for (const catName of Object.keys(categories)) {
                entreeList.push(...categories[catName]);
            }
        }

        return entreeList;
    }

    //////////////////////////////////////
    // 3) “PLAN PLATE” BUTTON HANDLER   //
    //////////////////////////////////////

    async function onPlanPlatePress() {
        // Parse each field; blank => undefined
        const cals =
            calorieTarget.trim() === ""
                ? undefined
                : parseInt(calorieTarget, 10);
        const prot =
            proteinTarget.trim() === ""
                ? undefined
                : parseInt(proteinTarget, 10);
        const carbs =
            carbTarget.trim() === "" ? undefined : parseInt(carbTarget, 10);
        const fat =
            fatTarget.trim() === "" ? undefined : parseInt(fatTarget, 10);

        // Validate numeric input if not blank
        if (
            (cals !== undefined && Number.isNaN(cals)) ||
            (prot !== undefined && Number.isNaN(prot)) ||
            (carbs !== undefined && Number.isNaN(carbs)) ||
            (fat !== undefined && Number.isNaN(fat))
        ) {
            Alert.alert(
                "Invalid Input",
                "Please enter valid numbers or leave blank."
            );
            return;
        }

        // Require at least one macro field
        if (
            cals === undefined &&
            prot === undefined &&
            carbs === undefined &&
            fat === undefined
        ) {
            Alert.alert(
                "No Macros",
                "Please specify at least one macro target (or enter 0)."
            );
            return;
        }

        setLoading(true);
        setError(null);
        setMatches([]);

        try {
            // 1) Get entrées for the fixed mealPeriod
            const mealEntreeList = getEntreeListFromCache();
            if (mealEntreeList.length === 0) {
                throw new Error(
                    "No entrées found for that hall/period in cache."
                );
            }

            // 2) Generate up to 3 servings of each entrée
            const maxServings = 3;
            const virtualList = generateVirtualItems(
                mealEntreeList,
                maxServings
            );

            // 3) Build partial target Nutrition
            const targetNut: Partial<Nutrition> = {
                calories: cals,
                protein: prot,
                carbs: carbs,
                fat: fat,
            };

            // 4) Find combinations (up to 3 items)
            const maxComboSize = 3;
            const combos = findPlateCombinations(
                virtualList,
                targetNut,
                maxComboSize
            );

            if (combos.length === 0) {
                Alert.alert(
                    "No Matches",
                    "No combination of entrées (from cache) hits the specified macros."
                );
                setLoading(false);
                return;
            }

            setMatches(combos);
        } catch (err: any) {
            console.warn(err);
            setError(err.message || "An unknown error occurred.");
        } finally {
            setLoading(false);
        }
    }

    ////////////////////////////
    // 4) RENDERING RESULTS   //
    ////////////////////////////

    function renderCombo({ item: combo }: { item: VirtualMenuItem[] }) {
        const totalNut: Nutrition = combo.reduce(
            (acc, vItem) => ({
                calories: acc.calories + vItem.nutrition.calories,
                protein: acc.protein + vItem.nutrition.protein,
                carbs: acc.carbs + vItem.nutrition.carbs,
                fat: acc.fat + vItem.nutrition.fat,
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        return (
            <View style={styles.comboContainer}>
                <Text style={styles.comboHeader}>
                    • Combination (Totals: {totalNut.calories} kcal;{" "}
                    {totalNut.protein}g P; {totalNut.carbs}g C; {totalNut.fat}g
                    F)
                </Text>
                {combo.map((vItem) => (
                    <Text key={vItem.key} style={styles.comboItemText}>
                        – {vItem.servings}× {vItem.original.name} (
                        {vItem.nutrition.calories} kcal,{" "}
                        {vItem.nutrition.protein}g P, {vItem.nutrition.carbs}g
                        C, {vItem.nutrition.fat}g F)
                    </Text>
                ))}
            </View>
        );
    }

    /////////////////////////
    // 5) MAIN JSX OUTPUT  //
    /////////////////////////

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Plate Planner</Text>

                {/* Show Hall Name and fixed mealPeriod */}
                <Text style={styles.subHeader}>
                    {hallName} — {mealPeriod}
                </Text>

                {/* Macro Inputs (leave blank to ignore) */}
                <Text style={styles.label}>Calorie Target (kcal):</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={calorieTarget}
                    onChangeText={setCalorieTarget}
                    placeholder="e.g. 600 (leave blank to ignore)"
                />

                <Text style={styles.label}>Protein Target (g):</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={proteinTarget}
                    onChangeText={setProteinTarget}
                    placeholder="e.g. 40 (leave blank to ignore)"
                />

                <Text style={styles.label}>Carb Target (g):</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={carbTarget}
                    onChangeText={setCarbTarget}
                    placeholder="e.g. 60 (leave blank to ignore)"
                />

                <Text style={styles.label}>Fat Target (g):</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={fatTarget}
                    onChangeText={setFatTarget}
                    placeholder="e.g. 20 (leave blank to ignore)"
                />

                {/* “Plan Plate” button */}
                <TouchableOpacity
                    style={styles.button}
                    onPress={onPlanPlatePress}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? "Planning..." : "Plan Plate"}
                    </Text>
                </TouchableOpacity>

                {/* Error message */}
                {error ? (
                    <Text style={styles.errorText}>Error: {error}</Text>
                ) : null}

                {/* Loading spinner */}
                {loading ? (
                    <ActivityIndicator
                        size="large"
                        color="#0C234B"
                        style={{ marginTop: 16 }}
                    />
                ) : null}

                {/* Display matching combinations */}
                {!loading && matches.length > 0 ? (
                    <>
                        <Text style={styles.resultsHeader}>
                            Matching Combinations:
                        </Text>
                        <FlatList
                            data={matches}
                            renderItem={renderCombo}
                            keyExtractor={(_, idx) => `combo__${idx}`}
                        />
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

/////////////////////
// 6) STYLESHEET   //
/////////////////////

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFF",
    },
    scrollContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 12,
        textAlign: "center",
        color: "#0C234B",
    },
    subHeader: {
        fontSize: 18,
        marginBottom: 16,
        textAlign: "center",
        color: "#333",
    },
    label: {
        fontSize: 16,
        marginTop: 12,
        marginBottom: 4,
        color: "#333",
    },
    input: {
        height: 40,
        borderColor: "#CCC",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        fontSize: 16,
        color: "#000",
        marginBottom: 8,
    },
    button: {
        marginTop: 16,
        backgroundColor: "#0C234B",
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
    },
    buttonText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    errorText: {
        marginTop: 16,
        color: "red",
        fontSize: 14,
        textAlign: "center",
    },
    resultsHeader: {
        marginTop: 24,
        fontSize: 20,
        fontWeight: "600",
        color: "#0C234B",
    },
    comboContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: "#F0F0F0",
        borderRadius: 8,
    },
    comboHeader: {
        fontWeight: "600",
        marginBottom: 6,
        color: "#0C234B",
    },
    comboItemText: {
        fontSize: 14,
        marginLeft: 8,
        color: "#333",
    },
});
