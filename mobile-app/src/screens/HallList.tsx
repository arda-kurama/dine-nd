import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import summary from "../../assets/data/menu_summary.json";
import { MenuSummary } from "../types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

type NavProp = NativeStackNavigationProp<RootStackParamList, "Halls">;

export default function HallList({ navigation }: { navigation: NavProp }) {
    const data = summary as MenuSummary;
    const halls = Object.keys(data.dining_halls);

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <FlatList
                data={halls}
                keyExtractor={(h) => h}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate("Meals", { hall: item })
                        }
                    >
                        <Text style={{ fontSize: 18, padding: 8 }}>{item}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}
