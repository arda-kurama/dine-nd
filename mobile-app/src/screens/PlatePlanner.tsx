import React, { useState, useEffect } from "react";
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/index";
import { cachedMenu } from "./DiningHallScreen";
import {
    PlannerMenuItem,
    Nutrition,
    generateVirtualItems,
    findPlateCombinations,
    VirtualMenuItem,
} from "../utils/PlatePlannerUtils";
import type { MenuItem } from "../types";

// ND Theme Colors
const ND_BLUE = "#0C234B";
const ND_GOLD = "#FFC72C";

type Props = NativeStackScreenProps<RootStackParamList, "PlatePlanner">;

export default function PlatePlanner({ route }: Props) {
    const { hallId, hallName, mealPeriod } = route.params;

    // Category data
    const [categoryList, setCategoryList] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("All");

    useEffect(() => {
        const hallData = cachedMenu?.dining_halls?.[hallId]?.[mealPeriod];
        if (hallData?.available) {
            const cats = ["All", ...Object.keys(hallData.categories).sort()];
            setCategoryList(cats);
            setSelectedCategory("All");
        } else {
            setCategoryList(["All"]);
            setSelectedCategory("All");
        }
    }, [hallId, mealPeriod]);

    // Macro input state
    const [calorieTarget, setCalorieTarget] = useState<string>("");
    const [proteinTarget, setProteinTarget] = useState<string>("");
    const [carbTarget, setCarbTarget] = useState<string>("");
    const [fatTarget, setFatTarget] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [matches, setMatches] = useState<VirtualMenuItem[][]>([]);
    const [error, setError] = useState<string | null>(null);

    // Prepare macro fields with explicit tuple typing
    const macroFields: [string, string, (v: string) => void][] = [
        ["Calories", calorieTarget, setCalorieTarget],
        ["Protein", proteinTarget, setProteinTarget],
        ["Carbs", carbTarget, setCarbTarget],
        ["Fat", fatTarget, setFatTarget],
    ];

    // Handler: Plan Plate
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
            Alert.alert("No Macros", "Specify at least one macro target.");
            return;
        }

        setLoading(true);
        setError(null);
        setMatches([]);

        try {
            const hallData = cachedMenu?.dining_halls?.[hallId]?.[mealPeriod];
            if (!hallData || hallData.available === false) {
                throw new Error("No data available for this hall/meal.");
            }

            const rawCats = hallData.categories as Record<string, MenuItem[]>;
            const plannerCats: Record<string, PlannerMenuItem[]> = {};
            Object.entries(rawCats).forEach(([cat, items]) => {
                plannerCats[cat] = items.map((item, idx) => ({
                    id: `${cat}-${idx}`,
                    ...item,
                }));
            });

            const entreeList =
                selectedCategory === "All"
                    ? Object.values(plannerCats).flat()
                    : plannerCats[selectedCategory] || [];

            if (entreeList.length === 0) {
                throw new Error(`No items in "${selectedCategory}".`);
            }

            const virtualList = generateVirtualItems(entreeList, 3);
            const targetNut: Partial<Nutrition> = {
                calories: cals,
                protein: prot,
                carbs,
                fat,
            };
            const combos = findPlateCombinations(virtualList, targetNut, 3);

            if (combos.length === 0) {
                Alert.alert(
                    "No Matches",
                    `No combos in "${selectedCategory}" hit those targets.`
                );
            } else {
                setMatches(combos);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{hallName}</Text>
                <Text style={styles.headerSubtitle}>{mealPeriod}</Text>
            </View>

            {/* Controls + Results */}
            <FlatList<VirtualMenuItem[]>
                data={matches}
                keyExtractor={(_, idx) => `combo_${idx}`}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={() => (
                    <View style={styles.controls}>
                        {/* Picker */}
                        <Text style={styles.label}>Category</Text>
                        <View style={styles.pickerBorder}>
                            <Picker
                                selectedValue={selectedCategory}
                                onValueChange={setSelectedCategory}
                                mode={
                                    Platform.OS === "ios"
                                        ? "dialog"
                                        : "dropdown"
                                }
                                style={styles.picker}
                            >
                                {categoryList.map((cat) => (
                                    <Picker.Item
                                        label={cat}
                                        value={cat}
                                        key={cat}
                                    />
                                ))}
                            </Picker>
                        </View>

                        {/* Macro Inputs */}
                        {macroFields.map(([label, value, setter]) => (
                            <View key={label} style={styles.inputRow}>
                                <Text style={styles.inputLabel}>{label}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={value}
                                    onChangeText={setter}
                                    keyboardType="numeric"
                                    placeholder="--"
                                />
                            </View>
                        ))}

                        {/* Plan Button & Error */}
                        <TouchableOpacity
                            style={styles.button}
                            onPress={onPlanPlatePress}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={ND_BLUE} />
                            ) : (
                                <Text style={styles.buttonText}>
                                    Plan Plate
                                </Text>
                            )}
                        </TouchableOpacity>
                        {error && <Text style={styles.error}>{error}</Text>}
                    </View>
                )}
                renderItem={({ item, index }) => (
                    <View style={styles.comboCard}>
                        {item.map((vItem, i) => (
                            <Text
                                key={`${index}_${i}`}
                                style={styles.comboText}
                            >
                                {vItem.servings}× {vItem.original.name}
                            </Text>
                        ))}
                    </View>
                )}
                ListEmptyComponent={() => (
                    <Text style={styles.emptyText}>
                        Enter targets and tap Plan Plate to see combos.
                    </Text>
                )}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: { backgroundColor: ND_BLUE, padding: 16 },
    headerTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
    headerSubtitle: { color: ND_GOLD, fontSize: 16, marginTop: 4 },
    listContent: { padding: 16 },
    controls: {
        marginBottom: 24,
        backgroundColor: "#f9f9f9",
        padding: 16,
        borderRadius: 8,
    },
    label: { fontSize: 16, color: ND_BLUE, marginBottom: 8 },
    pickerBorder: {
        borderWidth: 1,
        borderColor: ND_BLUE,
        borderRadius: 6,
        marginBottom: 16,
        overflow: "hidden",
    },
    picker: { width: "100%", height: 44 },
    inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    inputLabel: { flex: 1, fontSize: 14, color: ND_BLUE },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: ND_GOLD,
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    button: {
        backgroundColor: ND_GOLD,
        padding: 12,
        borderRadius: 6,
        alignItems: "center",
        marginTop: 8,
    },
    buttonText: { color: ND_BLUE, fontWeight: "600" },
    error: { color: "red", marginTop: 8, textAlign: "center" },
    comboCard: {
        backgroundColor: "#fff",
        padding: 12,
        borderRadius: 6,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    comboText: { fontSize: 14, color: "#333" },
    emptyText: { color: "#666", textAlign: "center", marginTop: 32 },
});
