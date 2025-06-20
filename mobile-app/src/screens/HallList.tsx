import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Image,
    SafeAreaView,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList, MenuSummary } from "../components/types";
import {
    SUMMARY_URL,
    DEFAULT_IMAGE,
    width,
    CARD_HEIGHT,
    hallImages,
} from "../components/constants";
import {
    colors,
    spacing,
    radii,
    shadows,
    typography,
    sharedStyles,
} from "../components/themes";

// Define navigation prop type specific to this screen
type HallListNavProp = NativeStackNavigationProp<RootStackParamList, "Halls">;

// Define the props for this component
type Props = { navigation: HallListNavProp };

// Main component for displaying the list of dining halls
export default function HallList({ navigation }: Props) {
    // State for menu summary data, loading status, and error handling
    const [summary, setSummary] = useState<MenuSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Fetch the menu summary data on initial render
    useEffect(() => {
        fetch(SUMMARY_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<MenuSummary>;
            })
            .then((json) => {
                setSummary(json);
                setIsLoading(false);
            })
            .catch(() => {
                setError("Could not load menu. Please try again.");
                setIsLoading(false);
            });
    }, []);

    // Show loading indicated while data is being fetched
    if (isLoading) {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" color={colors.accent} />
            </SafeAreaView>
        );
    }

    // Show error message if fetch failed or no summary data
    if (error || !summary) {
        return (
            <SafeAreaView style={styles.center}>
                <Text style={sharedStyles.errorText}>{error}</Text>
            </SafeAreaView>
        );
    }

    // Extract dining hall names from the summary data
    const halls = Object.keys(summary.dining_halls);

    // Render the list of dining halls
    return (
        <SafeAreaView style={sharedStyles.screenSurface}>
            <FlatList
                data={halls}
                keyExtractor={(name) => name}
                contentContainerStyle={{ paddingVertical: spacing.md }}
                ItemSeparatorComponent={() => (
                    <View style={{ height: spacing.sm }} />
                )}
                renderItem={({ item: hallName }) => {
                    const mealCount = summary.dining_halls[hallName] ?? 0;
                    const hasMeals = mealCount > 0;
                    const imageSource = hallImages[hallName] || DEFAULT_IMAGE;

                    return (
                        <View style={styles.cardWrapper}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() =>
                                    navigation.navigate("DiningHall", {
                                        hallId: hallName,
                                        hallName,
                                    })
                                }
                            >
                                <Image
                                    source={imageSource}
                                    style={styles.hallImage}
                                    resizeMode="cover"
                                />
                                <View style={styles.captionContainer}>
                                    <Text style={styles.hallTitle}>
                                        {hallName}
                                    </Text>
                                    <View style={styles.statusRow}>
                                        <View
                                            style={[
                                                styles.statusIndicator,
                                                {
                                                    backgroundColor: hasMeals
                                                        ? colors.success
                                                        : colors.error,
                                                },
                                            ]}
                                        />
                                        <Text style={styles.mealCountText}>
                                            {mealCount} meal
                                            {mealCount !== 1 ? "s" : ""}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    cardWrapper: {
        marginVertical: spacing.xs,
        marginHorizontal: spacing.md,
        borderRadius: radii.md,
        overflow: "hidden",
        ...shadows.card,
        width: width - spacing.xl,
    },
    hallImage: {
        width: width,
        height: CARD_HEIGHT,
    },
    captionContainer: {
        backgroundColor: colors.accent,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    hallTitle: {
        ...typography.h2,
        color: colors.background,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: spacing.xs,
    },
    statusIndicator: {
        width: spacing.sm,
        height: spacing.sm,
        borderRadius: radii.sm,
        marginRight: spacing.xs,
    },
    mealCountText: {
        ...typography.body,
        color: colors.background,
    },
});
