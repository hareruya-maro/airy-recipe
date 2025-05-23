import { useNavigation, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Appbar, Card, Portal, Snackbar, Text } from "react-native-paper";
import { Recipe, useRecipeStore } from "../../../store/recipeStore";

// FirestoreのTimestampを日付文字列に変換する関数
const formatDate = (timestamp: any): string => {
  if (!timestamp) return "日付なし";

  try {
    // Firestoreのタイムスタンプの場合
    if (timestamp.toDate) {
      const date = timestamp.toDate();
      return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // JavaScriptのDate型の場合
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return "日付なし";
  } catch (err) {
    console.error("日付変換エラー:", err);
    return "日付なし";
  }
};

export default function HomeScreen() {
  const { recipes, fetchRecipes, isLoadingRecipes } = useRecipeStore();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // コンポーネントのマウント時にFirestoreからレシピを取得
  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // 引っ張って更新する処理
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
    setSnackbarMessage("レシピを更新しました");
    setSnackbarVisible(true);
  };

  // レシピカード選択時の処理
  const handleRecipeSelect = (recipe: Recipe) => {
    router.push(`/(drawer)/(home)/detail?id=${recipe.id}`);
  };

  // ドロワーを開く処理
  const openDrawer = () => {
    navigation.openDrawer();
  };

  // イメージアップロードページに遷移
  const navigateToImageUpload = () => {
    router.push("/(drawer)/(home)/imageUpload");
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
              調理時間: {item.cookTime}分
            </Text>
            <Text variant="bodySmall" style={styles.metaItem}>
              難易度: {item.difficulty}
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.dateText}>
            登録日時: {formatDate(item.createdAt)}
          </Text>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <>
      <Appbar.Header>
        <Appbar.Action icon="menu" onPress={openDrawer} />
        <Appbar.Content title="AIry Recipe" />
        <Appbar.Action
          icon="book-open-page-variant"
          onPress={navigateToImageUpload}
        />
      </Appbar.Header>

      {/* レシピリスト */}
      {isLoadingRecipes ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>レシピを読み込み中...</Text>
        </View>
      ) : recipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="headlineMedium" style={styles.emptyText}>
            レシピがありません
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtext}>
            レシピデータがFirestoreに登録されていません。
            サンプルレシピのインポートスクリプトを実行してください。
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          renderItem={renderRecipeCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.recipeList}
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* スナックバー通知 */}
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
          {snackbarMessage}
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
  dateText: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtext: {
    textAlign: "center",
    opacity: 0.7,
  },
});
