import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { RecipeDetail } from "../../../components/recipe/RecipeDetail";
import { useRecipeStore } from "../../../store/recipeStore";

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes } = useRecipeStore();
  const router = useRouter();

  // IDに基づいてレシピを検索
  const recipe = recipes.find((r) => r.id === id);

  // レシピが見つからない場合
  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text variant="headlineMedium">レシピが見つかりませんでした</Text>
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
});
