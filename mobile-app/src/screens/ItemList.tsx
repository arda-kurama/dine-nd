// src/screens/ItemList.tsx
import React from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
} from "react-native";
import detail from "../../assets/data/consolidated_menu.json";
import type { MenuDetail, MenuItem } from "../types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

type NavProp = NativeStackNavigationProp<RootStackParamList, "Items">;

export default function ItemList({
    navigation,
    route,
}: {
    navigation: NavProp;
    route: { params: { hall: string; meal: string; category: string } };
}) {
    const { hall, meal, category } = route.params;
    const data = detail as MenuDetail;
    const items: MenuItem[] =
        data.dining_halls[hall][meal].categories[category] || [];

    return (
        <View style={styles.container}>
            <Text style={styles.header}>
                {hall} – {meal} – {category}
            </Text>
            <FlatList
                data={items}
                keyExtractor={(i) => i.name}
                renderItem={({ item }) => (
                    // Wrap each item in a TouchableOpacity:
                    <TouchableOpacity
                        style={styles.itemRow}
                        onPress={() =>
                            navigation.navigate("ItemDetail", { item })
                        }
                    >
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemServing}>
                            {item.serving_size}
                        </Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    header: { fontSize: 22, marginBottom: 12, fontWeight: "600" },
    itemRow: { marginBottom: 12, paddingVertical: 8 },
    itemName: { fontSize: 18 },
    itemServing: { color: "#555" },
});
