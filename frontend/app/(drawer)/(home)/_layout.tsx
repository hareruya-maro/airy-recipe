import { Stack } from "expo-router";
import React from "react";

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "AIry Recipe",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="detail"
        options={{
          title: "レシピ詳細",
          headerBackTitle: "戻る",
          presentation: "card",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
