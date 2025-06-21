import React from "react";
import {
    NativeStackNavigationProp,
    createNativeStackNavigator,
} from "@react-navigation/native-stack";
import {
    NavigationContainer,
    useNavigation,
    createNavigationContainerRef,
} from "@react-navigation/native";
import {
    View,
    StyleSheet,
    Text,
    Image,
    TouchableOpacity,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Screen specific types and themes
import type { RootStackParamList } from "../components/types";
import { colors, spacing, typography } from "../components/themes";

// Import all screens
import HallList from "../screens/HallList";
import DiningHallScreen from "../screens/DiningHallScreen";
import PlatePlanner from "../screens/PlatePlanner";
import ItemDetail from "../screens/ItemDetail";
import InfoScreen from "../screens/InfoScreen";

// Load logo asset
const logo = require("../../assets/tab-icon.png");

// Create a stack navigator with typed route names and parameters
const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Custom tappable header component to render the DineND logo and text
function HeaderTitle() {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <TouchableOpacity
            onPress={() => {
                try {
                    if (navigation.canGoBack()) {
                        navigation.popToTop();
                    }
                } catch (err) {
                    // silent fail — avoid dev-only warning
                }
            }}
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
        <NavigationContainer ref={navigationRef}>
            {/* Start on the HallList screen */}
            <Stack.Navigator
                initialRouteName="Halls"
                screenOptions={{
                    headerStyle: { backgroundColor: colors.primary },
                    headerTintColor: "#FFF",
                    headerTitleAlign: "center",
                    headerBackTitle: "Back",
                    // Render Logo + DineND Title
                    headerTitle: () => <HeaderTitle />,
                    // Render info icon
                    headerRight: () => (
                        <View>
                            <TouchableOpacity
                                onPress={() =>
                                    navigationRef.current?.navigate("Info")
                                }
                                style={{
                                    ...styles.infoButton,
                                    marginRight: Platform.select({
                                        ios: 0,
                                        android: spacing.md,
                                        web: spacing.md,
                                    }),
                                }}
                                hitSlop={{
                                    top: 10,
                                    bottom: 10,
                                    left: 10,
                                    right: 10,
                                }}
                            >
                                <Ionicons
                                    name="information-circle-outline"
                                    size={26}
                                    color="#FFF"
                                />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            >
                {/* Define all navigable screens in app */}
                <Stack.Screen name="Halls" component={HallList} />
                <Stack.Screen name="DiningHall" component={DiningHallScreen} />
                <Stack.Screen name="PlatePlanner" component={PlatePlanner} />
                <Stack.Screen name="ItemDetail" component={ItemDetail} />
                <Stack.Screen name="Info" component={InfoScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    // Styles for header title and logo
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.xs,
    },
    infoButton: {
        height: 40,
        width: 40,
        justifyContent: "center",
        alignItems: "flex-end",
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
