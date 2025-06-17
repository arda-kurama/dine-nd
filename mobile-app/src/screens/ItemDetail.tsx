import React from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../components/types";
import {
    colors,
    spacing,
    typography,
    radii,
    shadows,
} from "../components/themes";

// Define the props for this screen
type Props = NativeStackScreenProps<RootStackParamList, "ItemDetail">;

export default function ItemDetail({ route }: Props) {
    // Pull item details from route parameters
    const { itemDetail } = route.params;
    const {
        name,
        serving_size,
        nutrition,
        daily_values,
        ingredients,
        allergens,
    } = itemDetail;

    // Define the rows for the nutrition facts table
    const nutrientDefs = [
        { label: "Calories", value: nutrition?.calories ?? 0, daily: "" },
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
        { label: "Potassium", value: nutrition?.potassium ?? 0, daily: "" },
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
        { label: "Sugars", value: nutrition?.sugars ?? 0, daily: "" },
        {
            label: "Protein",
            value: nutrition?.protein ?? 0,
            daily: daily_values?.protein ?? "",
        },
    ];

    const renderNutrientRow = (
        label: string,
        value: number | string,
        daily: string,
        idx: number
    ) => {
        const suffix = daily.trim() ? ` (${daily})` : "";
        return (
            <View style={styles.tableRow} key={`${label}-${idx}`}>
                <Text style={styles.tableCellLabel}>{label}</Text>
                <Text style={styles.tableCellValue}>
                    {value}
                    {suffix}
                </Text>
            </View>
        );
    };

    const renderTextSection = (title: string, body: string) => (
        <View style={styles.sectionCard} key={title}>
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
            {/* Header Card */}
            <View style={styles.headerCard}>
                <Text style={styles.itemName}>{name}</Text>
                <Text
                    style={styles.itemServing}
                >{`Serving Size: ${serving_size}`}</Text>
            </View>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Nutrition Facts as a single card */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>
                            Nutrition Facts
                        </Text>
                    </View>
                    <View style={styles.sectionBody}>
                        {nutrientDefs.map((n, i) =>
                            renderNutrientRow(n.label, n.value, n.daily, i)
                        )}
                    </View>
                </View>

                {/* Ingredients & Allergens Sections */}
                {renderTextSection("Ingredients", ingredients)}
                {renderTextSection("Allergens", allergens)}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    content: { padding: spacing.md },

    headerCard: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
        ...shadows.card,
    },
    itemName: {
        ...typography.h1,
        color: colors.surface,
        marginBottom: spacing.xs,
    },
    itemServing: { ...typography.body, color: colors.accent },

    sectionCard: {
        backgroundColor: colors.background,
        borderRadius: radii.md,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    sectionHeader: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderTopLeftRadius: radii.md,
        borderTopRightRadius: radii.md,
    },
    sectionHeaderText: { ...typography.h2, color: colors.accent },
    sectionBody: { padding: spacing.md },

    tableRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: spacing.sm,
    },
    tableCellLabel: { ...typography.body, color: colors.textPrimary },
    tableCellValue: { ...typography.body, color: colors.textPrimary },

    paragraph: {
        ...typography.body,
        color: colors.textPrimary,
        lineHeight: typography.body.fontSize! * 1.5,
    },
});
