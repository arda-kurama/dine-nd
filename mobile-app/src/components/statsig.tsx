import React, { useEffect, useState } from "react";
import { StatsigProviderExpo, useStatsigClient } from "@statsig/expo-bindings";

// Imports for Statsig and Expo SecureStore anonymous user IDs
import * as SecureStore from "expo-secure-store";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

// Safe to expose - this is a client SDK key, not a secret
const sdkKey = "client-faCp1AGVMQdlWGsaLxfTK04p7DV0ey3Af0qZW9MKu6t";

// Creates or fetches a persistent anon user ID from SecureStore
async function getOrCreateAnonID(): Promise<string> {
    const key = "anon_user_id";

    // Use a timeout to prevent hanging if SecureStore fails
    const timeout = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("SecureStore timeout")), 5000)
    );

    // Attempt to fetch the ID from SecureStore, or create a new one if it doesn't exist
    const fetch = (async () => {
        let id = await SecureStore.getItemAsync(key);
        if (!id) {
            id = uuidv4();
            await SecureStore.setItemAsync(key, id);
        }
        return id;
    })();

    // Return the first promise that resolves: either the fetch or the timeout
    return Promise.race([timeout, fetch]);
}

// Initialize Statsig with a unique user ID
export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [userID, setUserID] = useState<string | null>(null);

    // Fetch or create the anonymous user ID on first render
    useEffect(() => {
        getOrCreateAnonID()
            .then((id) => {
                setUserID(id);
            })
            .catch((err) => {
                setUserID("fallback-anon-id");
            });
    }, []);

    // Still loading the user ID, return null to avoid rendering
    if (!userID) return null;

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

// Hook exposing all analytics logging functions here, instead of in each component
export function useAnalytics() {
    const { client } = useStatsigClient();

    // Define all event types and names used in Statsig tracking throughout the app
    const EVT = {
        PAGE_VIEW: "page_view",
        ITEM_ADDED: "item_added",
        ITEM_REMOVED: "item_removed",
        SERVING_CHANGED: "serving_changed",
        PLATE_PLANNER_SUCCESS: "plate_planner_success",
        PLATE_PLANNER_FAILED: "plate_planner_failed",
        FINAL_PLATE: "final_plate",
        FINAL_PLATE_ITEM: "final_plate_item",
    } as const;
    type Event = (typeof EVT)[keyof typeof EVT];

    // Generic function to log an event with optional properties and value
    const fire = (e: Event, props?: Record<string, any>, value?: number) =>
        client.logEvent(e, value, props);

    return {
        fire,

        // Navigation and page view events
        pageViewed: (screen: string, props: Record<string, any> = {}) =>
            fire(EVT.PAGE_VIEW, { screen, ...props }),

        // Menu interaction events
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

        // Plate planner events
        plannerSuccess: (
            cuisine: string,
            macros: Record<string, number>,
            allergens: string[]
        ) =>
            fire(EVT.PLATE_PLANNER_SUCCESS, {
                cuisine,
                calories: Number(macros.calories),
                protein: Number(macros.protein),
                carbs: Number(macros.carbs),
                fat: Number(macros.fat),
                allergens,
            }),
        plannerError: (error: string) =>
            fire(EVT.PLATE_PLANNER_FAILED, { error }),

        // Final plate submission events
        finalPlate: (
            hallName: string,
            meal: string,
            items: { name: string; servings: number }[],
            macros: Record<string, number>,
            trigger: "navigate" | "background"
        ) => {
            // Unique ID for the plate to correlate summary and item events
            const plateId = uuidv4();

            // Summary event for the plate
            fire(EVT.FINAL_PLATE, {
                plateId,
                hallName,
                meal,
                trigger,
                calories: Number(macros.calories),
                protein: Number(macros.protein),
                carbs: Number(macros.carbs),
                fat: Number(macros.fat),
                total_items: items.length,
            });

            // Individual item events for each plate item
            items.forEach(({ name, servings }) =>
                fire(EVT.FINAL_PLATE_ITEM, {
                    plateId,
                    hallName,
                    meal,
                    itemName: name,
                    servings,
                })
            );
        },
    };
}
