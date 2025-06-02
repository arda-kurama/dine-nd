import React from "react";
import { SafeAreaView, Text, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/index"; // adjust path if needed

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

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/** ITEM NAME & SERVING SIZE **/}
                <Text style={styles.title}>{name}</Text>
                <Text
                    style={styles.subtitle}
                >{`Serving Size: ${serving_size}`}</Text>

                {/** NUTRITION FACTS **/}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Nutrition Facts</Text>
                    <Text
                        style={styles.nutriLine}
                    >{`Calories: ${nutrition.calories}`}</Text>
                    <Text
                        style={styles.nutriLine}
                    >{`Total Fat: ${nutrition.total_fat} (${daily_values.total_fat})`}</Text>
                    <Text
                        style={styles.nutriLine}
                    >{`Saturated Fat: ${nutrition.saturated_fat} (${daily_values.saturated_fat})`}</Text>
                    <Text
                        style={styles.nutriLine}
                    >{`Cholesterol: ${nutrition.cholesterol} (${daily_values.cholesterol})`}</Text>
                    <Text
                        style={styles.nutriLine}
                    >{`Sodium: ${nutrition.sodium} (${daily_values.sodium})`}</Text>
                    <Text
                        style={styles.nutriLine}
                    >{`Total Carbs: ${nutrition.total_carbs} (${daily_values.total_carbs})`}</Text>
                    <Text
                        style={styles.nutriLine}
                    >{`Dietary Fiber: ${nutrition.dietary_fiber} (${daily_values.dietary_fiber})`}</Text>
                    <Text
                        style={styles.nutriLine}
                    >{`Sugars: ${nutrition.sugars}`}</Text>
                    <Text
                        style={styles.nutriLine}
                    >{`Protein: ${nutrition.protein}`}</Text>
                </View>

                {/** INGREDIENTS **/}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ingredients</Text>
                    <Text style={styles.paragraph}>{ingredients}</Text>
                </View>

                {/** ALLERGENS **/}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Allergens</Text>
                    <Text style={styles.paragraph}>{allergens}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000000",
    },
    content: {
        padding: 16,
        backgroundColor: "#0C234B", // ND‐blue
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: "#FFFFFF",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: "#CCCCCC",
        marginBottom: 12,
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#FFFFFF",
        marginBottom: 6,
    },
    nutriLine: {
        fontSize: 14,
        color: "#FFFFFF",
        marginBottom: 2,
    },
    paragraph: {
        fontSize: 14,
        color: "#FFFFFF",
        lineHeight: 20,
    },
});
