import React, { useEffect } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import { useAnalytics } from "../components/statsig";

// Screen specific types and themes
import type { RootStackParamList } from "../components/types";
import {
    colors,
    typography,
    sharedStyles,
    spacing,
} from "../components/themes";

// Define navigation props for this screen
type Props = NativeStackScreenProps<RootStackParamList, "ItemDetail">;

// Main item detail screen
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

    // Track page view analytics
    const { pageViewed } = useAnalytics();
    useEffect(() => {
        pageViewed("ItemDetail", { item: itemDetail.name });
    }, [itemDetail.name]);

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

    // Renders a row for a nutrient (label on left, value + %DV on right)
    const renderNutrientRow = (
        label: string,
        value: number | string,
        daily: string,
        idx: number
    ) => {
        const suffix = daily.trim() ? ` (${daily})` : "";
        return (
            <View style={sharedStyles.rowBetween} key={`${label}-${idx}`}>
                <Text style={sharedStyles.buttonTextDark}>{label}</Text>
                <Text style={styles.tableCellValue}>
                    {value}
                    {suffix}
                </Text>
            </View>
        );
    };

    // Generic section rendering for text blocks like Ingredients/Allergens
    const renderTextSection = (title: string, body: string) => (
        <View style={sharedStyles.sectionCard} key={title}>
            <View style={sharedStyles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
            <View style={sharedStyles.sectionBody}>
                <Text style={styles.paragraph}>{body}</Text>
            </View>
        </View>
    );

    // Main screen render
    return (
        <SafeAreaView style={sharedStyles.screenSurface}>
            {/* Header card: item name and serving size */}
            <View style={sharedStyles.cardHeader}>
                <Text style={sharedStyles.titleSurface}>{name}</Text>
                <Text
                    style={sharedStyles.subtitleAccent}
                >{`Serving Size: ${serving_size}`}</Text>
            </View>

            {/* Scrollable body content */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: spacing.md }}
            >
                {/* Nutrition Facts section */}
                <View style={sharedStyles.sectionCard}>
                    <View style={sharedStyles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>
                            Nutrition Facts
                        </Text>
                    </View>
                    <View style={sharedStyles.sectionBody}>
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
    // Text styles
    sectionHeaderText: { ...typography.h2, color: colors.accent },
    paragraph: {
        ...typography.body,
        color: colors.textPrimary,
        lineHeight: typography.body.fontSize! * 1.5,
    },

    // Table styles
    tableCellValue: { ...typography.body, color: colors.textPrimary },
});
