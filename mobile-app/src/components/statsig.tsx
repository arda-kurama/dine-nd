import React, { useEffect, useState } from "react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { StatsigProviderExpo, useStatsigClient } from "@statsig/expo-bindings";

const sdkKey =
    Constants.manifestExtra?.STATSIG_CLIENT_KEY ??
    Constants.expoConfig?.extra?.STATSIG_CLIENT_KEY;

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
        PAGE_VIEW: "page_view",
        ITEM_ADDED: "item_added",
        ITEM_REMOVED: "item_removed",
        SERVING_CHANGED: "serving_changed",
        PLATE_PLANNER_SUCCESS: "plate_planner_success",
        PLATE_PLANNER_FAILED: "plate_planner_failed",
        FINAL_PLATE: "final_plate",
    } as const;

    type Event = (typeof EVT)[keyof typeof EVT];
    const fire = (e: Event, props?: Record<string, any>, value?: number) =>
        client.logEvent(e, value, props);

    return {
        fire,
        pageViewed: (screen: string, props: Record<string, any> = {}) =>
            fire(EVT.PAGE_VIEW, { screen, ...props }),
        itemAdded: (itemName: string, hallName: string, meal: string) =>
            fire(EVT.ITEM_ADDED, { itemName, hallName, meal }),
        itemRemoved: (
            itemName: string,
            hallName: string,
            meal: string,
            location: string
        ) => fire(EVT.ITEM_REMOVED, { itemName, hallName, meal, location }),
        servingSizeChanged: (
            itemName: string,
            servings: number,
            hallName: string,
            meal: string
        ) =>
            fire(EVT.SERVING_CHANGED, {
                itemName,
                servings,
                hallName,
                meal,
            }),
        plannerSuccess: (
            cuisine: string,
            macros: Record<string, number>,
            allergens: string[]
        ) => fire(EVT.PLATE_PLANNER_SUCCESS, { cuisine, macros, allergens }),
        plannerError: (error: string) =>
            fire(EVT.PLATE_PLANNER_FAILED, { error }),
        finalPlate: (
            hallName: string,
            meal: string,
            items: { name: string; servings: number }[],
            macros: {
                calories: number;
                protein: number;
                carbs: number;
                fat: number;
            }
        ) => fire(EVT.FINAL_PLATE, { hallName, meal, items, macros }),
    };
}
