import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Drawer } from "expo-router/drawer";
import React from "react";

// リアニメーテッドが必要
import "react-native-gesture-handler";
import { Icon, useTheme } from "react-native-paper";

export default function DrawerLayout() {
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme ?? "light"].tint;

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        headerTintColor: colors.primary,
        drawerActiveTintColor: colors.primary,
        drawerActiveBackgroundColor: colors.primaryContainer,
        drawerInactiveBackgroundColor: colors.surface,
        headerBackgroundContainerStyle: {
          backgroundColor: colors.surface,
        },
      }}
    >
      <Drawer.Screen
        name="(home)"
        options={{
          title: "ホーム",
          drawerLabel: "ホーム",
          drawerIcon: ({ color }) => (
            <Icon size={24} source="home" color={color} />
          ),
          swipeEnabled: false,
        }}
      />
    </Drawer>
  );
}
