import React, { useEffect, useState } from "react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { StatsigProviderExpo, useStatsigClient } from "@statsig/expo-bindings";

const sdkKey = Constants.expoConfig!.extra!.STATSIG_CLIENT_KEY as string;

// Generate a unique ID for the user on install and store it securely
async function getOrCreateAnonID(): Promise<string> {
    const key = "anon_user_id";

    const timeout = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("SecureStore timeout")), 5000)
    );

    const fetch = (async () => {
        let id = await SecureStore.getItemAsync(key);
        if (!id) {
            id = uuidv4();
            await SecureStore.setItemAsync(key, id);
        }
        return id;
    })();

    return Promise.race([timeout, fetch]);
}
// Initialize Statsig with a unique user ID
export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [userID, setUserID] = useState<string | null>(null);

    useEffect(() => {
        console.log("🔧 fetching user ID...");
        getOrCreateAnonID()
            .then((id) => {
                console.log("✅ got user ID:", id);
                setUserID(id);
            })
            .catch((err) => {
                console.warn("❌ failed to get user ID:", err);
                setUserID("fallback-anon-id");
            });
    }, []);

    if (!userID) return null; // still loading first launch

    return (
        <StatsigProviderExpo
            sdkKey={sdkKey}
            user={{ userID }} // real, unique ID
            loadingComponent={null}
        >
            {children}
        </StatsigProviderExpo>
    );
};

export function useAnalytics() {
    const { client } = useStatsigClient();

    // Event names and types
    const EVT = {
        HALL_SELECTED: "hall_selected",
        ITEM_ADDED: "item_added",
        PLANNER_SUCCESS: "plate_planner_used",
        PLANNER_ERROR: "plate_planner_failed",
    } as const;

    type Event = (typeof EVT)[keyof typeof EVT];
    const fire = (e: Event, props?: Record<string, any>, value?: number) =>
        client.logEvent(e, value, props);

    return {
        // Generic event logger
        fire,

        // Hall selected
        hallSelected: (hallName: string) =>
            fire(EVT.HALL_SELECTED, { hallName }),

        // Item added to my plate
        itemAdded: (itemName: string, hallName: string, meal: string) =>
            fire(EVT.ITEM_ADDED, { itemName, hallName, meal }),

        // Plate planner success
        platePlannerUsed: (
            cuisine: string,
            macros: Record<string, number>,
            allergens: string[]
        ) => fire(EVT.PLANNER_SUCCESS, { cuisine, macros, allergens }),

        // Plate planner failure
        platePlannerFailed: (error: string) =>
            fire(EVT.PLANNER_ERROR, { error }),
    };
}
