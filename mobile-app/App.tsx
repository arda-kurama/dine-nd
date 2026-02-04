import { Asset } from "expo-asset";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
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
                // If an update is available, fetch it and reload so THIS launch uses it.
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                    return; // reloadAsync restarts JS, so just stop here
                }

                // Preload assets used by the app (include hall images + default)
                await Asset.loadAsync([
                    require("./assets/icon.png"),
                    require("./assets/tab-icon.png"),
                    require("./assets/halls/hcc.jpg"),
                    require("./assets/halls/north.jpg"),
                    require("./assets/halls/smc.jpg"),
                    require("./assets/halls/south.jpg"),
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
