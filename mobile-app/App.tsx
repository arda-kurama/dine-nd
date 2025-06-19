import { Asset } from "expo-asset";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RootSiblingParent } from "react-native-root-siblings";
import AppNavigator from "./src/components";

SplashScreen.preventAutoHideAsync();

export default function App() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        async function loadAssets() {
            try {
                await Asset.loadAsync([
                    require("./assets/icon.png"),
                    require("./assets/tab-icon.png"),
                ]);
            } catch (e) {
                console.warn(e);
            } finally {
                setReady(true);
                await SplashScreen.hideAsync();
            }
        }

        loadAssets();
    }, []);

    if (!ready) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <RootSiblingParent>
                <AppNavigator />
            </RootSiblingParent>
        </GestureHandlerRootView>
    );
}
