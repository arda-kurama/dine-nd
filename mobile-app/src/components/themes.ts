import { StyleSheet, TextStyle, ViewStyle } from "react-native";

// Default colors
export const colors = {
    primary: "#0C2340", // ND blue
    accent: "#C99700", // ND gold
    success: "#00843D", // ND green
    background: "#FFFFFF", // White
    surface: "#F8F8F8", // Light Cream
    textPrimary: "#0C234B", // Dark Blue
    textSecondary: "#666666", // Gray
    error: "#E53935", // Red
};

// Standardized spacing options
export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
};

export const radii = {
    sm: 4,
    md: 8,
    lg: 12,
};

// Standardized shadows
export const shadows: {
    card: ViewStyle;
    heavy?: ViewStyle;
} = {
    card: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    heavy: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
};

// Standardize text sizes
export const typography: {
    h1: TextStyle;
    h2: TextStyle;
    body: TextStyle;
    button: TextStyle;
} = {
    h1: { fontSize: 24, fontWeight: "700" },
    h2: { fontSize: 18, fontWeight: "600" },
    body: { fontSize: 14, fontWeight: "400" },
    button: { fontSize: 16, fontWeight: "600" },
};

// Standardized styles
export const sharedStyles = StyleSheet.create({
    screenSurface: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    input: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.accent,
        borderRadius: radii.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        color: colors.textPrimary,
        backgroundColor: colors.surface,
        width: 64,
        textAlign: "center",
    },
    button: {
        backgroundColor: colors.accent,
        padding: spacing.sm,
        borderRadius: radii.sm,
        alignItems: "center",
        margin: spacing.md,
    },
    titleSurface: {
        ...typography.h1,
        color: colors.surface,
    },
    subtitleAccent: {
        ...typography.body,
        color: colors.accent,
    },
    text: {
        ...typography.body,
        color: colors.textPrimary,
    },
    textBackground: {
        ...typography.body,
        color: colors.background,
    },
    textSecondary: {
        ...typography.body,
        color: colors.textSecondary,
    },
    errorText: {
        ...typography.body,
        color: colors.error,
        textAlign: "center",
        padding: spacing.md,
    },
    buttonTextLight: {
        ...typography.button,
        color: colors.surface,
    },
    buttonTextDark: {
        ...typography.button,
        color: colors.textPrimary,
    },
    shadowCard: {
        ...shadows.card,
        borderRadius: radii.md,
    },
    cardHeader: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
        ...shadows.card,
    },
    sectionCard: {
        backgroundColor: colors.background,
        borderRadius: radii.md,
        marginTop: spacing.md,
        marginHorizontal: spacing.md,
        ...shadows.card,
    },
    sectionHeader: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderTopLeftRadius: radii.md,
        borderTopRightRadius: radii.md,
    },
    sectionHeaderText: {
        ...typography.h2,
        color: colors.accent,
    },
    sectionBody: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    rowBetween: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.accent,
        paddingVertical: spacing.sm,
    },
});
