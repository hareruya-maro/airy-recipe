import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { RecipeDetail } from "../../../components/recipe/RecipeDetail";
import { Recipe, useRecipeStore } from "../../../store/recipeStore";

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, fetchRecipeDetails } = useRecipeStore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  // コンポーネントのマウント時またはIDが変更されたときにレシピ詳細を取得
  useEffect(() => {
    if (!id) {
      setError("レシピIDが指定されていません");
      return;
    }

    // まずキャッシュを確認
    const cachedRecipe = recipes.find((r) => r.id === id);
    if (
      cachedRecipe &&
      cachedRecipe.ingredients?.length > 0 &&
      cachedRecipe.steps?.length > 0
    ) {
      // すでに詳細情報が読み込まれている場合はそれを使用
      setRecipe(cachedRecipe);
      return;
    }

    // 詳細情報を取得
    const loadDetails = async () => {
      setIsLoading(true);
      try {
        const fetchedRecipe = await fetchRecipeDetails(id as string);
        setRecipe(fetchedRecipe);
        setError(null);
      } catch (err) {
        console.error("レシピ詳細の取得に失敗:", err);
        setError("レシピの読み込みに失敗しました");
        setRecipe(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [id, fetchRecipeDetails]); // recipesを依存配列から削除

  // 読み込み中の表示
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>レシピ情報を読み込み中...</Text>
      </View>
    );
  }

  // エラー表示
  if (error || !recipe) {
    return (
      <View style={styles.container}>
        <Text variant="headlineMedium">
          {error || "レシピが見つかりませんでした"}
        </Text>
        <Button
          mode="contained"
          onPress={() => router.replace("/(drawer)/(home)")}
          style={styles.button}
        >
          ホームに戻る
        </Button>
      </View>
    );
  }

  return <RecipeDetail recipe={recipe} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  button: {
    marginTop: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
