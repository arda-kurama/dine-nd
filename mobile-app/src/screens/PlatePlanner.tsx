import React, { useState } from "react";
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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/index";

// ND Theme Colors
const ND_BLUE = "#0C234B";
const ND_GOLD = "#FFC72C";

type Props = NativeStackScreenProps<RootStackParamList, "PlatePlanner">;

type ApiResponse = {
    items: { name: string; servings: number }[];
    totals: { calories: number; protein: number; carbs: number; fat: number };
};

export default function PlatePlanner({ route }: Props) {
    const { hallName, mealPeriod } = route.params;

    const [calorieTarget, setCalorieTarget] = useState<string>("");
    const [proteinTarget, setProteinTarget] = useState<string>("");
    const [carbTarget, setCarbTarget] = useState<string>("");
    const [fatTarget, setFatTarget] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [result, setResult] = useState<ApiResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const macroFields: [
        label: string,
        value: string,
        setter: (text: string) => void
    ][] = [
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
            const response = await fetch(
                "https://uycl10fz1j.execute-api.us-east-2.amazonaws.com/dev/plan-plate",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        hall: hallName,
                        meal: mealPeriod,
                        calorieTarget: cals,
                        proteinTarget: prot,
                        carbTarget: carbs,
                        fatTarget: fat,
                    }),
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

    const renderItem = ({
        item,
    }: {
        item: { name: string; servings: number };
    }) => (
        <View style={styles.comboRow}>
            <Text style={styles.comboText}>
                {item.servings}× {item.name}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{hallName}</Text>
                <Text style={styles.headerSubtitle}>{mealPeriod}</Text>
            </View>
            <View style={styles.controls}>
                {macroFields.map(([label, value, setter]) => (
                    <View key={label} style={styles.inputRow}>
                        <Text style={styles.inputLabel}>{label}</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            placeholder="--"
                            value={value}
                            onChangeText={(text) => setter(text)}
                        />
                    </View>
                ))}
                <TouchableOpacity
                    style={styles.button}
                    onPress={onPlanPlatePress}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={ND_BLUE} />
                    ) : (
                        <Text style={styles.buttonText}>Plan Plate</Text>
                    )}
                </TouchableOpacity>
                {error && <Text style={styles.error}>{error}</Text>}
            </View>
            {result && (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultHeader}>Your Plate:</Text>
                    <FlatList
                        data={result.items}
                        keyExtractor={(item, i) => `${item.name}_${i}`}
                        renderItem={renderItem}
                    />
                    <View style={styles.totals}>
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
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: { backgroundColor: ND_BLUE, padding: 16 },
    headerTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
    headerSubtitle: { color: ND_GOLD, fontSize: 16, marginTop: 4 },
    controls: { padding: 16 },
    inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    inputLabel: { flex: 1, color: ND_BLUE, fontSize: 14 },
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
    resultContainer: { flex: 1, padding: 16 },
    resultHeader: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 8,
        color: ND_BLUE,
    },
    comboRow: { flexDirection: "row", marginVertical: 4 },
    comboText: { fontSize: 16, color: "#333" },
    totals: {
        marginTop: 16,
        borderTopWidth: 1,
        borderColor: "#ddd",
        paddingTop: 8,
    },
    totalsText: { color: ND_BLUE, fontSize: 14, marginVertical: 2 },
});
