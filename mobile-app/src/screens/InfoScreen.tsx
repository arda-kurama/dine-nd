import React, { useEffect } from "react";
import {
    ScrollView,
    Text,
    Linking,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAnalytics } from "../components/statsig";

// Screen specific themes
import {
    sharedStyles,
    colors,
    spacing,
    typography,
} from "../components/themes";

// Reusable component for rendering a link-style button with an Ionicon icon
function LinkButton({
    label,
    url,
    iconName,
}: {
    label: string;
    url: string;
    iconName: keyof typeof Ionicons.glyphMap;
}) {
    return (
        <TouchableOpacity
            // Opens the specified URL when the button is pressed
            onPress={() => Linking.openURL(url)}
            style={styles.linkWrapper}
            activeOpacity={0.7}
        >
            <Ionicons
                name={iconName}
                size={20}
                color={colors.accent}
                style={{ marginRight: spacing.sm }}
            />
            <Text style={styles.linkText}>{label}</Text>
        </TouchableOpacity>
    );
}

// Main info screen
export default function InfoScreen() {
    const { pageViewed } = useAnalytics();

    useEffect(() => {
        pageViewed("InfoScreen");
    }, []);

    return (
        <SafeAreaView style={sharedStyles.screenSurface}>
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={sharedStyles.cardHeader}>
                    <Text style={sharedStyles.titleSurface}>About DineND</Text>
                    <Text style={sharedStyles.subtitleAccent}>
                        Created by Arda Kurama
                    </Text>
                </View>

                {/* Links section */}
                <View style={sharedStyles.sectionCard}>
                    <View style={sharedStyles.sectionHeader}>
                        <Text style={sharedStyles.sectionHeaderText}>
                            Connect
                        </Text>
                    </View>
                    <View style={sharedStyles.sectionBody}>
                        <LinkButton
                            label="GitHub Profile"
                            url="https://github.com/arda-kurama"
                            iconName="logo-github"
                        />
                        <LinkButton
                            label="LinkedIn"
                            url="https://www.linkedin.com/in/ardakurama/"
                            iconName="logo-linkedin"
                        />
                        <LinkButton
                            label="Report a Bug"
                            url="mailto:ardakurama@gmail.com"
                            iconName="bug-outline"
                        />
                    </View>
                </View>

                {/* Credits section */}
                <View style={sharedStyles.sectionCard}>
                    <View style={sharedStyles.sectionHeader}>
                        <Text style={sharedStyles.sectionHeaderText}>
                            Credits
                        </Text>
                    </View>
                    <View style={sharedStyles.sectionBody}>
                        <Text style={sharedStyles.textSecondary}>
                            This app uses University of Notre Dame Campus Dining
                            data and open-source libraries. All rights belong to
                            their respective owners.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: spacing.lg,
    },

    // Styles for links
    linkWrapper: {
        marginBottom: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
    },
    linkText: {
        ...typography.body,
        color: colors.accent,
        textDecorationLine: "underline",
    },
});
