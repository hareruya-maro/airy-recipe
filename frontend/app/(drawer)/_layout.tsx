import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Drawer } from "expo-router/drawer";
import React from "react";

// リアニメーテッドが必要
import "react-native-gesture-handler";
import { Icon } from "react-native-paper";

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme ?? "light"].tint;

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        headerTintColor: tintColor,
        drawerActiveTintColor: tintColor,
      }}
    >
      <Drawer.Screen
        name="(home)"
        options={{
          title: "ホーム",
          drawerLabel: "ホーム",
          drawerIcon: ({ color }) => (
            <Icon size={24} source="house" color={color} />
          ),
          swipeEnabled: false,
        }}
      />
    </Drawer>
  );
}
