import { Asset } from "expo-asset";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RootSiblingParent } from "react-native-root-siblings";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation";
import { AnalyticsProvider } from "./src/components/statsig";
SplashScreen.preventAutoHideAsync();

// Main component to load entire app
export default function App() {
    // State variable to determine which assets have loaded
    const [ready, setReady] = useState(false);

    // Preload all assets on mount
    useEffect(() => {
        async function loadAssets() {
            try {
                await Asset.loadAsync([
                    require("./assets/icon.png"),
                    require("./assets/tab-icon.png"),
                ]);
            } catch (e) {
                // Warn if any image loading fails, but continue regardless
                console.warn(e);
            } finally {
                // Once done mark app as ready
                setReady(true);
                await SplashScreen.hideAsync();
            }
        }

        loadAssets();
    }, []);

    // While loading assets, show nothing (splash screen remains visible)
    if (!ready) return null;

    return (
        <AnalyticsProvider>
            <SafeAreaProvider>
                {/* Needed for gesture-based components like drawers or modals */}
                <GestureHandlerRootView style={{ flex: 1 }}>
                    {/* Enables root-level components like Toast or Modal from anywhere */}
                    <RootSiblingParent>
                        {/* App's navigation hierarchy (e.g. stack/tab screens) */}
                        <AppNavigator />
                    </RootSiblingParent>
                </GestureHandlerRootView>
            </SafeAreaProvider>
        </AnalyticsProvider>
    );
}
