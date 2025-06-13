import { TextStyle, ViewStyle } from "react-native";

export const colors = {
    primary: "#0C2340", // ND blue
    accent: "#C99700", // ND gold
    success: "#00843D", // ND green
    background: "#FFFFFF",
    surface: "#F8F8F8",
    textPrimary: "#0C234B",
    textSecondary: "#666666",
    error: "#E53935",
};

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

/**
 * Shadows for cards, etc.
 * ViewStyle works even on Android (elevation),
 * and iOS will pick up the shadow* props.
 */
export const shadows: {
    card: ViewStyle;
    heavy?: ViewStyle;
} = {
    card: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    heavy: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
};

/**
 * Text styles.
 * We tell TS these are TextStyle so you can safely spread them
 * into a StyleSheet.
 */
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
