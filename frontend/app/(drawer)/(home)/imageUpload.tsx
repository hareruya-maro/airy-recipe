import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Appbar } from "react-native-paper";
import { RecipeImageUploader } from "../../../components/ui/RecipeImageUploader";
import { RecipeProcessingResult } from "../../../hooks/useImageUpload";
import { useImageUploadStore } from "../../../store/imageUploadStore";

export default function ImageUploadScreen() {
  const router = useRouter();
  const { addUploadResult } = useImageUploadStore();

  // アップロード完了時の処理
  const handleUploadComplete = (result: { folder: string; urls: string[] }) => {
    // アップロード結果をストアに保存
    addUploadResult(result);
  };

  // レシピ処理完了時の処理
  const handleRecipeProcessed = (recipeResult: RecipeProcessingResult) => {
    // レシピが解析され保存された場合、詳細画面に遷移
    if (recipeResult && recipeResult.recipeId) {
      // 少し待ってから詳細画面に遷移
      setTimeout(() => {
        router.push(`/(drawer)/(home)/detail?id=${recipeResult.recipeId}`);
      }, 1000);
    }
  };

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="レシピ本の写真撮影・アップロード" />
      </Appbar.Header>

      <View style={styles.container}>
        <RecipeImageUploader
          onUploadComplete={handleUploadComplete}
          onRecipeProcessed={handleRecipeProcessed}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
