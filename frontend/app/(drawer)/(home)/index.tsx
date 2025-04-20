import { useNavigation, useRouter } from "expo-router";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { Appbar, Card, Surface, Text } from "react-native-paper";
import { Recipe, useRecipeStore } from "../../../store/recipeStore";

export default function HomeScreen() {
  const { recipes } = useRecipeStore();
  const router = useRouter();
  const navigation = useNavigation<any>();

  // レシピカード選択時の処理
  const handleRecipeSelect = (recipe: Recipe) => {
    router.push(`/(drawer)/(home)/detail?id=${recipe.id}`);
  };

  // ドロワーを開く処理
  const openDrawer = () => {
    navigation.openDrawer();
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
        <Appbar.Action icon="cog" onPress={() => {}} />
      </Appbar.Header>
      <Surface style={styles.container}>
        <FlatList
          data={recipes}
          renderItem={renderRecipeCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.recipeList}
          style={{ height: "100%" }} // 追加: FlatListの高さを100%に設定
        />
      </Surface>
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
});
