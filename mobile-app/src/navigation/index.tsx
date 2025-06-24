import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    Platform,
    View,
    StyleSheet,
    Text,
    Image,
    TouchableOpacity,
    StatusBar,
} from "react-native";
import {
    NavigationContainer,
    createNavigationContainerRef,
    useNavigation,
} from "@react-navigation/native";
import {
    createNativeStackNavigator,
    NativeStackNavigationProp,
} from "@react-navigation/native-stack";

// Icon set
import { Ionicons } from "@expo/vector-icons";

// Screen specific themes and types
import { colors, spacing, typography } from "../components/themes";
import type { RootStackParamList } from "../components/types";

// Screen components
import HallList from "../screens/HallList";
import DiningHallScreen from "../screens/DiningHallScreen";
import PlatePlanner from "../screens/PlatePlanner";
import ItemDetail from "../screens/ItemDetail";
import InfoScreen from "../screens/InfoScreen";

// Logo asset used in header
const logo = require("../../assets/tab-icon.png");

// Stack navigator and navigation ref
const Stack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Custom header title component used on iOS header
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

// Android back button used inside custom android header
function AndroidBackButton() {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    if (!navigation.canGoBack()) {
        return null;
    }
    return (
        <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
        </TouchableOpacity>
    );
}

// Complete custom header for Android
function AndroidFixedHeader({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets();
    return (
        <View style={[styles.fixedHeaderContainer, { paddingTop: insets.top }]}>
            <StatusBar
                barStyle="light-content"
                backgroundColor={colors.primary}
            />
            {/* Left side: back button area */}
            <View style={styles.headerSide}>
                <AndroidBackButton />
            </View>
            {/* Center: logo and title, resets navigation to Halls */}
            <TouchableOpacity
                style={styles.centerContainer}
                onPress={() =>
                    navigation.reset({ index: 0, routes: [{ name: "Halls" }] })
                }
                activeOpacity={0.8}
            >
                <Image source={logo} style={styles.logo} resizeMode="contain" />
                <Text style={styles.title}>DineND</Text>
            </TouchableOpacity>
            {/* Right side: info button */}
            <View style={styles.headerSide}>
                <TouchableOpacity
                    onPress={() => navigation.navigate("Info")}
                    style={styles.infoButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons
                        name="information-circle-outline"
                        size={24}
                        color={colors.surface}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

// iOS native header options for the stack navigator
const iosScreenOptions = {
    headerStyle: { backgroundColor: colors.primary },
    headerTintColor: colors.surface,
    headerBackTitle: "Back",
    headerTitle: () => <HeaderTitle />,
    headerRight: () => (
        <TouchableOpacity
            onPress={() => navigationRef.current?.navigate("Info")}
            style={styles.infoButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <Ionicons
                name="information-circle-outline"
                size={24}
                color="#FFF"
            />
        </TouchableOpacity>
    ),
    gestureEnabled: true,
    contentStyle: { backgroundColor: colors.surface },
};

// Android custom header options for the stack navigator
const androidScreenOptions = {
    header: (props: any) => <AndroidFixedHeader {...props} />,
    animation: "fade" as const,
    detachPreviousScreen: true,
    gestureEnabled: true,
};

// Main navigator components
export default function AppNavigator() {
    const screenOptions =
        Platform.OS === "ios" ? iosScreenOptions : androidScreenOptions;

    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
                initialRouteName="Halls"
                screenOptions={screenOptions}
            >
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
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
    },
    fixedHeaderContainer: {
        backgroundColor: colors.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        paddingHorizontal: spacing.md,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    headerSide: {
        width: 60,
        alignItems: "center",
    },
    centerContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    backButton: {
        padding: spacing.sm,
        justifyContent: "center",
        alignItems: "center",
    },
    infoButton: {
        height: 40,
        width: 40,
        justifyContent: "center",
        alignItems: "center",
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
