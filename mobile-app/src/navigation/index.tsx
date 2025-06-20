import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { StyleSheet, View, Text, Image } from "react-native";
import type { RootStackParamList } from "../components/types";
import { colors, spacing, typography } from "../components/themes";

import HallList from "../screens/HallList";
import DiningHallScreen from "../screens/DiningHallScreen";
import PlatePlanner from "../screens/PlatePlanner";
import ItemDetail from "../screens/ItemDetail";

const Stack = createNativeStackNavigator<RootStackParamList>();
const logo = require("../../assets/tab-icon.png");

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Halls"
                screenOptions={{
                    headerStyle: { backgroundColor: colors.primary },
                    headerTintColor: "#FFF",
                    headerTitleAlign: "center",
                    headerBackTitle: "Back",
                    headerTitle: () => (
                        <View style={styles.container}>
                            <Image
                                source={logo}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                            <Text style={styles.title}>DineND</Text>
                        </View>
                    ),
                }}
            >
                <Stack.Screen name="Halls" component={HallList} />
                <Stack.Screen name="DiningHall" component={DiningHallScreen} />
                <Stack.Screen name="PlatePlanner" component={PlatePlanner} />
                <Stack.Screen name="ItemDetail" component={ItemDetail} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
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
