import { useNavigation, useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { Appbar, Card, Portal, Snackbar, Text } from "react-native-paper";
import { RecipeImageUploader } from "../../../components/ui/RecipeImageUploader";
import { useImageUploadStore } from "../../../store/imageUploadStore";
import { Recipe, useRecipeStore } from "../../../store/recipeStore";

export default function HomeScreen() {
  const { recipes } = useRecipeStore();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const [showUploader, setShowUploader] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const { addUploadResult } = useImageUploadStore();

  // レシピカード選択時の処理
  const handleRecipeSelect = (recipe: Recipe) => {
    router.push(`/(drawer)/(home)/detail?id=${recipe.id}`);
  };

  // ドロワーを開く処理
  const openDrawer = () => {
    navigation.openDrawer();
  };

  // アップローダーの表示/非表示を切り替える
  const toggleUploader = () => {
    setShowUploader(!showUploader);
  };

  // アップロード完了時の処理
  const handleUploadComplete = (result: { folder: string; urls: string[] }) => {
    // アップロード結果をストアに保存
    addUploadResult(result);

    // スナックバーを表示
    setSnackbarVisible(true);

    // アップローダーを閉じる
    setShowUploader(false);
  };

  // レシピカードの描画
  const renderRecipeCard = ({ item }: { item: Recipe }) => (
    <TouchableOpacity onPress={() => handleRecipeSelect(item)}>
      <Card style={styles.card} mode="elevated">
        <Card.Cover source={{ uri: item.image }} style={styles.cardImage} />
        <Card.Content style={styles.cardContent}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            {item.title}
          </Text>
          <Text
            variant="bodyMedium"
            numberOfLines={2}
            style={styles.cardDescription}
          >
            {item.description}
          </Text>
          <View style={styles.cardMeta}>
            <Text variant="bodySmall" style={styles.metaItem}>
              調理時間: {item.cookTime}
            </Text>
            <Text variant="bodySmall" style={styles.metaItem}>
              難易度: {item.difficulty}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <>
      <Appbar.Header>
        <Appbar.Action icon="menu" onPress={openDrawer} />
        <Appbar.Content title="AIry Recipe" />
        <Appbar.Action icon="cog" onPress={toggleUploader} />
      </Appbar.Header>

      {/* レシピリスト */}
      <FlatList
        data={recipes}
        renderItem={renderRecipeCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.recipeList}
        style={{ flex: 1 }}
      />

      {/* 画像アップローダーのポータル */}
      <Portal>
        {showUploader && (
          <View style={styles.uploaderContainer}>
            <Appbar.Header style={styles.uploaderHeader}>
              <Appbar.Content title="レシピ本の写真撮影・アップロード" />
              <Appbar.Action icon="close" onPress={toggleUploader} />
            </Appbar.Header>
            <RecipeImageUploader onUploadComplete={handleUploadComplete} />
          </View>
        )}
      </Portal>

      {/* アップロード完了通知 */}
      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{
            label: "閉じる",
            onPress: () => setSnackbarVisible(false),
          }}
        >
          画像のアップロードが完了しました
        </Snackbar>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    marginBottom: 24,
    textAlign: "center",
    opacity: 0.7,
  },
  recipeList: {
    padding: 8,
  },
  card: {
    marginBottom: 16,
    overflow: "hidden",
  },
  cardImage: {
    height: 180,
  },
  cardContent: {
    paddingVertical: 12,
  },
  cardTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  cardDescription: {
    marginBottom: 8,
    opacity: 0.8,
  },
  cardMeta: {
    flexDirection: "row",
    marginTop: 8,
  },
  metaItem: {
    marginRight: 16,
    opacity: 0.6,
  },
  uploaderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "white",
    zIndex: 1000,
  },
  uploaderHeader: {
    backgroundColor: "#f5f5f5",
    elevation: 4,
  },
});
