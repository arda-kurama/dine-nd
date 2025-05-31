import "react-native-gesture-handler"; // if you haven’t already
import React from "react";
import AppNavigator from "./src/navigation";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AppNavigator />
        </GestureHandlerRootView>
    );
}
