import React, { useState, useEffect } from "react";
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
    Platform,
    ActionSheetIOS,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Picker } from "@react-native-picker/picker";

import { ALLERGENS } from "../components/constants";
import type { RootStackParamList } from "../components/types";
import { colors, spacing, sharedStyles } from "../components/themes";

// Define props type for this screen
type Props = NativeStackScreenProps<RootStackParamList, "PlatePlanner">;

// Response shape from the planning API
interface ApiItem {
    category: string;
    name: string;
    servings: number;
    servingSize: string;
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
    const { hallId, hallName, mealPeriod } = route.params;

    // Macro target inputs
    const [calorieTarget, setCalorieTarget] = useState<string>("");
    const [proteinTarget, setProteinTarget] = useState<string>("");
    const [carbTarget, setCarbTarget] = useState<string>("");
    const [fatTarget, setFatTarget] = useState<string>("");

    // Allergy and section selection states
    const [avoidedAllergies, setAvoidedAllergies] = useState<string[]>([]);
    const [selectedSection, setSelectedSection] = useState<string>("");
    const [availableSections, setAvailableSections] = useState<string[]>([]);

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

    // Fetch available sections for this hall+meal
    useEffect(() => {
        async function loadSections() {
            try {
                const res = await fetch(
                    `https://uycl10fz1j.execute-api.us-east-2.amazonaws.com/dev/sections` +
                        `?hall=${encodeURIComponent(hallId)}` +
                        `&meal=${encodeURIComponent(mealPeriod)}`
                );
                if (!res.ok) throw new Error();
                const { sections } = await res.json();
                setAvailableSections(sections);
                if (!sections.includes(selectedSection)) {
                    setSelectedSection("");
                }
            } catch {
                setAvailableSections([]);
            }
        }
        loadSections();
    }, [hallId, mealPeriod]);

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
                sections: selectedSection ? [selectedSection] : [],
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
                let errMsg = `Unexpected error (HTTP ${response.status})`;
                try {
                    const json = await response.json();
                    if (json?.error) errMsg = json.error;
                } catch {
                    // fallback already set
                }
                throw new Error(errMsg);
            }
            const json: ApiResponse = await response.json();
            setResult(json);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const showSectionPicker = () => {
        ActionSheetIOS.showActionSheetWithOptions(
            {
                options: [...availableSections, "Cancel"],
                cancelButtonIndex: availableSections.length,
            },
            (idx) => {
                if (idx < availableSections.length) {
                    setSelectedSection(availableSections[idx]);
                }
            }
        );
    };

    return (
        <SafeAreaView style={sharedStyles.screenSurface}>
            <View style={sharedStyles.cardHeader}>
                <Text style={sharedStyles.titleSurface}>{hallName}</Text>
                <Text style={sharedStyles.subtitleAccent}>{mealPeriod}</Text>
            </View>
            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Section Selector */}
                <View style={sharedStyles.sectionCard}>
                    <View style={sharedStyles.sectionHeader}>
                        <Text style={sharedStyles.sectionHeaderText}>
                            Select Cuisine
                        </Text>
                    </View>
                    <View style={sharedStyles.sectionBody}>
                        {Platform.OS === "ios" ? (
                            <TouchableOpacity
                                onPress={showSectionPicker}
                                style={styles.pickerButton}
                            >
                                <Text style={sharedStyles.buttonTextDark}>
                                    {selectedSection || "Click Me"}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <Picker
                                selectedValue={selectedSection}
                                onValueChange={setSelectedSection}
                                style={styles.picker}
                                dropdownIconColor={colors.textPrimary}
                            >
                                <Picker.Item
                                    label="Click Me"
                                    value=""
                                    color={colors.textSecondary}
                                />
                                {availableSections.map((title) => (
                                    <Picker.Item
                                        key={title}
                                        label={title}
                                        value={title}
                                        color={colors.textPrimary}
                                    />
                                ))}
                            </Picker>
                        )}
                    </View>
                </View>
                {/* Macro Targets */}
                <View style={sharedStyles.sectionCard}>
                    <View style={sharedStyles.sectionHeader}>
                        <Text style={sharedStyles.sectionHeaderText}>
                            Set Macro Targets
                        </Text>
                    </View>
                    <View style={sharedStyles.sectionBody}>
                        {macroFields.map(([label, value, setter]) => (
                            <View key={label} style={sharedStyles.rowBetween}>
                                <Text style={sharedStyles.buttonTextDark}>
                                    {label}
                                </Text>
                                <TextInput
                                    style={sharedStyles.input}
                                    keyboardType="numeric"
                                    placeholder="--"
                                    placeholderTextColor={colors.textSecondary}
                                    value={value}
                                    onChangeText={setter}
                                />
                            </View>
                        ))}
                    </View>
                </View>

                {/* Avoid Allergens */}
                <View style={sharedStyles.sectionCard}>
                    <View style={sharedStyles.sectionHeader}>
                        <Text style={sharedStyles.sectionHeaderText}>
                            Avoid Allergens
                        </Text>
                    </View>
                    <View style={sharedStyles.sectionBody}>
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
                                        <Text
                                            style={sharedStyles.buttonTextDark}
                                        >
                                            {allergy}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Plan Button & Error */}
                <TouchableOpacity
                    style={sharedStyles.button}
                    onPress={onPlanPlatePress}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Text style={sharedStyles.buttonTextLight}>
                            Plan Plate
                        </Text>
                    )}
                </TouchableOpacity>
                {error && <Text style={sharedStyles.errorText}>{error}</Text>}

                {/* Results */}
                {result && (
                    <>
                        <View style={sharedStyles.sectionCard}>
                            <View style={sharedStyles.sectionHeader}>
                                <Text style={sharedStyles.sectionHeaderText}>
                                    Your Plate
                                </Text>
                            </View>
                            <View style={sharedStyles.sectionBody}>
                                {result.items.map((item, idx) => {
                                    const dishName = item.name;

                                    return (
                                        <View
                                            key={`${dishName}-${idx}`}
                                            style={sharedStyles.rowBetween}
                                        >
                                            <Text
                                                style={
                                                    sharedStyles.buttonTextDark
                                                }
                                            >
                                                {dishName}
                                            </Text>
                                            <Text>
                                                {item.servings}x{" "}
                                                {item.servingSize}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={sharedStyles.sectionCard}>
                            <View style={sharedStyles.sectionHeader}>
                                <Text style={sharedStyles.sectionHeaderText}>
                                    Total Macros
                                </Text>
                            </View>
                            <View style={sharedStyles.sectionBody}>
                                <View style={sharedStyles.rowBetween}>
                                    <Text style={sharedStyles.buttonTextDark}>
                                        Calories:
                                    </Text>
                                    <Text style={sharedStyles.text}>
                                        {result.totals.calories} kcal
                                    </Text>
                                </View>
                                <View style={sharedStyles.rowBetween}>
                                    <Text style={sharedStyles.buttonTextDark}>
                                        Protein:
                                    </Text>
                                    <Text style={sharedStyles.text}>
                                        {result.totals.protein} g
                                    </Text>
                                </View>
                                <View style={sharedStyles.rowBetween}>
                                    <Text style={sharedStyles.buttonTextDark}>
                                        Carbs:
                                    </Text>
                                    <Text style={sharedStyles.text}>
                                        {result.totals.carbs} g
                                    </Text>
                                </View>
                                <View style={sharedStyles.rowBetween}>
                                    <Text style={sharedStyles.buttonTextDark}>
                                        Fat:
                                    </Text>
                                    <Text style={sharedStyles.text}>
                                        {result.totals.fat} g
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    contentContainer: { paddingBottom: spacing.lg },
    picker: {
        height: spacing.lg * 2,
        color: colors.textPrimary,
        backgroundColor: colors.surface,
    },
    pickerButton: {
        paddingVertical: spacing.xs,
    },
    allergyOptions: { flexDirection: "row", flexWrap: "wrap" },
    switchContainer: {
        width: "50%",
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.xs,
    },
    switch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },
});
