import React from "react";
import {
    NativeStackNavigationProp,
    createNativeStackNavigator,
} from "@react-navigation/native-stack";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { StyleSheet, Text, Image, TouchableOpacity } from "react-native";

// Screen specific types and themes
import type { RootStackParamList } from "../components/types";
import { colors, spacing, typography } from "../components/themes";

// Import all screens
import HallList from "../screens/HallList";
import DiningHallScreen from "../screens/DiningHallScreen";
import PlatePlanner from "../screens/PlatePlanner";
import ItemDetail from "../screens/ItemDetail";

// Load logo asset
const logo = require("../../assets/tab-icon.png");

// Create a stack navigator with typed route names and parameters
const Stack = createNativeStackNavigator<RootStackParamList>();

// Custom tappable header component to render the DineND logo and text
function HeaderTitle() {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <TouchableOpacity
            onPress={() => navigation.popToTop()}
            style={styles.container}
            activeOpacity={0.8}
        >
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>DineND</Text>
        </TouchableOpacity>
    );
}

// Root navigation container and stack configuration
export default function AppNavigator() {
    return (
        <NavigationContainer>
            {/* Start on the HallList screen */}
            <Stack.Navigator
                initialRouteName="Halls"
                screenOptions={{
                    headerStyle: { backgroundColor: colors.primary },
                    headerTintColor: "#FFF",
                    headerTitleAlign: "center",
                    headerBackTitle: "Back",
                    headerTitle: () => <HeaderTitle />,
                }}
            >
                {/* Define all navigable screens in app */}
                <Stack.Screen name="Halls" component={HallList} />
                <Stack.Screen name="DiningHall" component={DiningHallScreen} />
                <Stack.Screen name="PlatePlanner" component={PlatePlanner} />
                <Stack.Screen name="ItemDetail" component={ItemDetail} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    // Styles for header title and logo
    container: {
        backgroundColor: colors.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.xs,
    },
    logo: {
        width: 48,
        height: 48,
    },
    title: {
        color: "#FFF",
        marginLeft: spacing.sm,
        ...typography.h1,
    },
});
