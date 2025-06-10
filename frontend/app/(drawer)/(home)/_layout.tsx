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
      <Stack.Screen
        name="editRecipe"
        options={{
          title: "レシピ編集",
          headerShown: false,
        }}
      />
      {/* 新しいimageUploadページを追加 */}
      <Stack.Screen
        name="imageUpload"
        options={{
          title: "レシピ登録",
          headerShown: false,
          presentation: "card",
        }}
      />
      {/* CookingModeをモーダル表示として設定 */}
      <Stack.Screen
        name="cookingMode"
        options={{
          title: "料理モード",
          presentation: "fullScreenModal", // モーダル表示
          animation: "slide_from_bottom", // 下からスライドアニメーション
          headerShown: false,
          gestureEnabled: true, // スワイプでモーダルを閉じることを許可
        }}
      />
    </Stack>
  );
}
