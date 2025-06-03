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

    /**
     * Build an array of nutrient definitions (label, value key, daily key).
     * Mapping over this avoids repeating renderNutrientRow calls.
     */
    const nutrientDefs = [
        {
            label: "Calories",
            value: nutrition?.calories ?? 0,
            daily: "",
        },
        {
            label: "Calories from Fat",
            value: nutrition?.calories_from_fat ?? 0,
            daily: "",
        },
        {
            label: "Total Fat",
            value: nutrition?.total_fat ?? 0,
            daily: daily_values?.total_fat ?? "",
        },
        {
            label: "Saturated Fat",
            value: nutrition?.saturated_fat ?? 0,
            daily: daily_values?.saturated_fat ?? "",
        },
        {
            label: "Cholesterol",
            value: nutrition?.cholesterol ?? 0,
            daily: daily_values?.cholesterol ?? "",
        },
        {
            label: "Sodium",
            value: nutrition?.sodium ?? 0,
            daily: daily_values?.sodium ?? "",
        },
        {
            label: "Potassium",
            value: nutrition?.potassium ?? 0,
            daily: "",
        },
        {
            label: "Total Carbohydrate",
            value: nutrition?.total_carbohydrate ?? 0,
            daily: daily_values?.total_carbohydrate ?? "",
        },
        {
            label: "Dietary Fiber",
            value: nutrition?.dietary_fiber ?? 0,
            daily: "",
        },
        {
            label: "Sugars",
            value: nutrition?.sugars ?? 0,
            daily: "",
        },
        {
            label: "Protein",
            value: nutrition?.protein ?? 0,
            daily: daily_values?.protein ?? "",
        },
    ];

    /**
     * Renders a single nutrient row. If `daily` is empty or whitespace, omit the "(% DV)" text.
     */
    const renderNutrientRow = (
        label: string,
        value: string | number,
        daily: string,
        idx: number
    ) => {
        const dailyText = daily.trim() ? ` (${daily})` : "";
        return (
            <View style={styles.tableRow} key={`${label}-${idx}`}>
                <Text style={styles.tableCellLabel}>{label}</Text>
                <Text style={styles.tableCellValue}>
                    {value}
                    {dailyText}
                </Text>
            </View>
        );
    };

    /**
     * Small helper to render a generic text section (e.g., Ingredients or Allergens).
     * Avoids repeating the same JSX structure twice.
     */
    const renderTextSection = (title: string, body: string) => (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
            <View style={styles.sectionBody}>
                <Text style={styles.paragraph}>{body}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/** ─── ITEM HEADER: Name + Serving Size ──────────────────────────── */}
                <View style={styles.headerCard}>
                    <Text style={styles.itemName}>{name}</Text>
                    <Text
                        style={styles.itemServing}
                    >{`Serving Size: ${serving_size}`}</Text>
                </View>

                {/** ─── NUTRITION FACTS SECTION ───────────────────────────────────── */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>
                            Nutrition Facts
                        </Text>
                    </View>
                    <View style={styles.tableContainer}>
                        {nutrientDefs.map((nutrient, idx) =>
                            renderNutrientRow(
                                nutrient.label,
                                nutrient.value,
                                nutrient.daily,
                                idx
                            )
                        )}
                    </View>
                </View>

                {/** ─── INGREDIENTS & ALLERGENS SECTIONS ─────────────────────────── */}
                {renderTextSection("Ingredients", ingredients)}
                {renderTextSection("Allergens", allergens)}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // ─── CONTAINER & CONTENT ─────────────────────────────────────────────────────
    container: {
        flex: 1,
        backgroundColor: "#1C1E2A",
    },
    content: {
        padding: 16,
        backgroundColor: "#1C1E2A",
    },

    // ─── ITEM HEADER CARD ────────────────────────────────────────────────────────
    headerCard: {
        backgroundColor: "#0C234B",
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
        color: "#C99700",
    },

    // ─── SECTION CARD ────────────────────────────────────────────────────────────
    sectionCard: {
        backgroundColor: "#1C1C1E",
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
        backgroundColor: "#0C234B",
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    sectionHeaderText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#C99700",
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
