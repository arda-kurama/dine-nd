// src/screens/ItemDetail.tsx

import React from "react";
import { SafeAreaView, View, Text, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/index";

type Props = NativeStackScreenProps<RootStackParamList, "ItemDetail">;

export default function ItemDetail({ route }: Props) {
    const { itemDetail } = route.params;
    const {
        name,
        serving_size,
        nutrition,
        daily_values,
        ingredients,
        allergens,
    } = itemDetail;

    // Helper to render a single nutrient row, omitting empty daily values
    const renderNutrientRow = (
        label: string,
        value: string | number,
        daily: string
    ) => {
        const dailyText = daily && daily.trim() !== "" ? ` (${daily})` : "";
        return (
            <View style={styles.tableRow} key={label}>
                <Text style={styles.tableCellLabel}>{label}</Text>
                <Text style={styles.tableCellValue}>
                    {value}
                    {dailyText}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/** ITEM HEADER **/}
                <View style={styles.headerCard}>
                    <Text style={styles.itemName}>{name}</Text>
                    <Text
                        style={styles.itemServing}
                    >{`Serving Size: ${serving_size}`}</Text>
                </View>

                {/** NUTRITION FACTS SECTION **/}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>
                            Nutrition Facts
                        </Text>
                    </View>
                    <View style={styles.tableContainer}>
                        {renderNutrientRow("Calories", nutrition.calories, "")}
                        {renderNutrientRow(
                            "Total Fat",
                            nutrition.total_fat,
                            daily_values.total_fat
                        )}
                        {renderNutrientRow(
                            "Saturated Fat",
                            nutrition.saturated_fat,
                            daily_values.saturated_fat
                        )}
                        {renderNutrientRow(
                            "Cholesterol",
                            nutrition.cholesterol,
                            daily_values.cholesterol
                        )}
                        {renderNutrientRow(
                            "Sodium",
                            nutrition.sodium,
                            daily_values.sodium
                        )}
                        {renderNutrientRow(
                            "Total Carbs",
                            nutrition.total_carbs,
                            daily_values.total_carbs
                        )}
                        {renderNutrientRow(
                            "Dietary Fiber",
                            nutrition.dietary_fiber,
                            daily_values.dietary_fiber
                        )}
                        {renderNutrientRow("Sugars", nutrition.sugars, "")}
                        {renderNutrientRow("Protein", nutrition.protein, "")}
                    </View>
                </View>

                {/** INGREDIENTS SECTION **/}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>
                            Ingredients
                        </Text>
                    </View>
                    <View style={styles.sectionBody}>
                        <Text style={styles.paragraph}>{ingredients}</Text>
                    </View>
                </View>

                {/** ALLERGENS SECTION **/}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>Allergens</Text>
                    </View>
                    <View style={styles.sectionBody}>
                        <Text style={styles.paragraph}>{allergens}</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // ─── CONTAINER & CONTENT ─────────────────────────────────────────────────────
    container: {
        flex: 1,
        backgroundColor: "#1C1E2A", // ND-themed dark charcoal
    },
    content: {
        padding: 16,
        backgroundColor: "#1C1E2A",
    },

    // ─── ITEM HEADER CARD ────────────────────────────────────────────────────────
    headerCard: {
        backgroundColor: "#0C234B", // ND blue
        borderRadius: 8,
        paddingVertical: 16,
        paddingHorizontal: 12,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    itemName: {
        fontSize: 22,
        fontWeight: "700",
        color: "#FFFFFF",
        marginBottom: 4,
    },
    itemServing: {
        fontSize: 14,
        color: "#C99700", // ND gold
    },

    // ─── SECTION CARD ────────────────────────────────────────────────────────────
    sectionCard: {
        backgroundColor: "#1C1C1E", // slightly lighter dark for contrast
        borderRadius: 8,
        marginBottom: 16,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    sectionHeader: {
        backgroundColor: "#0C234B", // ND blue
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    sectionHeaderText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#C99700", // ND gold
    },

    // ─── NUTRITION TABLE ─────────────────────────────────────────────────────────
    tableContainer: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    tableRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 4,
        borderBottomColor: "#2C2C2E",
        borderBottomWidth: 1,
    },
    tableCellLabel: {
        fontSize: 14,
        color: "#FFFFFF",
    },
    tableCellValue: {
        fontSize: 14,
        color: "#FFFFFF",
    },

    // ─── SECTION BODY TEXT ───────────────────────────────────────────────────────
    sectionBody: {
        padding: 12,
    },
    paragraph: {
        fontSize: 14,
        color: "#FFFFFF",
        lineHeight: 20,
    },
});
