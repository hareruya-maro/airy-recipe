import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Drawer } from "expo-router/drawer";
import React from "react";

// リアニメーテッドが必要
import "react-native-gesture-handler";

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
            <IconSymbol size={24} name="house.fill" color={color} />
          ),
          swipeEnabled: false,
        }}
      />
      <Drawer.Screen
        name="explore"
        options={{
          title: "探索",
          drawerLabel: "探索",
          drawerIcon: ({ color }) => (
            <IconSymbol size={24} name="paperplane.fill" color={color} />
          ),
        }}
      />
    </Drawer>
  );
}
