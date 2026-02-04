import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "./themes";

export default function ImageFallback({
    style,
}: {
    style: StyleProp<ViewStyle>;
}) {
    return (
        <LinearGradient
            colors={[colors.primary, colors.accent]}
            style={style}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        />
    );
}
