import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Button, Chip, Surface, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../config/firebase";
import { Recipe, useRecipeStore } from "../../store/recipeStore";
import { IngredientsList } from "./IngredientsList";
import { StepsList } from "./StepsList";

type RecipeDetailProps = {
  recipe: Recipe;
};

export const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe }) => {
  const { currentStepIndex, nextStep, previousStep, setCurrentRecipe } =
    useRecipeStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isEditable, setIsEditable] = useState(false);

  // レシピを現在のレシピとして設定し、編集権限をチェック
  useEffect(() => {
    setCurrentRecipe(recipe);

    // 編集権限の確認（自分で作成したレシピのみ編集可能）
    const currentUserId = auth.currentUser?.uid;
    setIsEditable(
      !!currentUserId &&
        recipe.createdBy === currentUserId &&
        recipe.isSystemRecipe !== true
    );
  }, [recipe.id]); // recipe.idのみを依存配列に追加し、不要な再レンダリングを防ぐ

  // 料理中モードを開始（Expo Routerでのモーダル表示に変更）
  const startCookingMode = () => {
    router.push("/(drawer)/(home)/cookingMode");
  };

  // 編集画面へ遷移
  const editRecipe = () => {
    router.push(`/(drawer)/(home)/editRecipe?id=${recipe.id}`);
  };

  // 通常のレシピ詳細表示
  return (
    <>
      <Appbar.Header>
        <Appbar.Action icon="chevron-left" onPress={router.back} />
        <Appbar.Content title="AIry Recipe" />
        {isEditable && <Appbar.Action icon="pencil" onPress={editRecipe} />}
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* レシピヘッダー */}
        <View style={styles.header}>
          <Image
            source={{ uri: recipe.image }}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.headerOverlay}>
            <Text variant="headlineMedium" style={styles.title}>
              {recipe.title}
            </Text>
          </View>
        </View>

        {/* レシピ情報 */}
        <Surface style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text variant="bodyMedium">準備時間</Text>
              <Text variant="titleMedium">{recipe.prepTime}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant="bodyMedium">調理時間</Text>
              <Text variant="titleMedium">{recipe.cookTime}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant="bodyMedium">難易度</Text>
              <Text variant="titleMedium">{recipe.difficulty}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant="bodyMedium">人数</Text>
              <Text variant="titleMedium">{recipe.servings}人分</Text>
            </View>
          </View>
        </Surface>

        {/* 説明文 */}
        <View style={styles.section}>
          <Text style={styles.description}>{recipe.description}</Text>
        </View>

        {/* タグ */}
        <View style={styles.tagsContainer}>
          {recipe.tags.map((tag, index) => (
            <Chip key={index} style={styles.tag} mode="outlined">
              {tag}
            </Chip>
          ))}
        </View>

        {/* 材料リスト */}
        <IngredientsList ingredients={recipe.ingredients} />

        {/* 手順リスト */}
        <StepsList
          steps={recipe.steps}
          currentStepIndex={currentStepIndex}
          onNextStep={nextStep}
          onPreviousStep={previousStep}
        />

        {/* コツとアドバイス */}
        {recipe.tips && recipe.tips.length > 0 && (
          <Surface style={styles.tipsSection}>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              コツとアドバイス
            </Text>
            {recipe.tips.map((tip, index) => (
              <Text key={index} style={styles.tipText}>
                • {tip}
              </Text>
            ))}
          </Surface>
        )}

        {/* 下部余白（フローティングボタンと重ならないようにする） */}
        <View style={[styles.buttonSpacer, { height: 100 + insets.bottom }]} />
      </ScrollView>

      {/* 料理開始ボタン - フローティングボタン */}
      <Button
        mode="contained"
        onPress={startCookingMode}
        style={[
          styles.floatingButton,
          { bottom: 24 + insets.bottom }, // SafeAreaに合わせて位置を調整
        ]}
        contentStyle={styles.cookButtonContent}
        labelStyle={styles.cookButtonLabel}
        icon="chef-hat"
      >
        料理を始める
      </Button>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    height: 250,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  headerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 16,
  },
  title: {
    color: "white",
    fontWeight: "bold",
  },
  infoContainer: {
    padding: 16,
    // backgroundColor: "#f9f9f9",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoItem: {
    alignItems: "center",
  },
  section: {
    padding: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  tag: {
    margin: 4,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  tipsSection: {
    padding: 16,
    // backgroundColor: "#f0f8ff",
    margin: 16,
    borderRadius: 8,
  },
  tipText: {
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 4,
  },
  cookButtonContent: {
    height: 50,
  },
  cookButtonLabel: {
    fontSize: 18,
  },
  // フローティングボタンスタイル
  floatingButton: {
    position: "absolute",
    // bottomはinsetに応じて動的に調整するためにここでは設定しない
    left: "10%",
    right: "10%",
    width: "80%",
    borderRadius: 30,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  // スクロール領域の下部に余白を追加
  buttonSpacer: {
    // heightはinsetに応じて動的に調整するためにここでは設定しない
  },
});
