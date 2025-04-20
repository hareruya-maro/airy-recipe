import React from "react";
import { FlatList, StyleSheet } from "react-native";
import { List, Surface, Text } from "react-native-paper";
import { Ingredient } from "../../store/recipeStore";

type IngredientsListProps = {
  ingredients: Ingredient[];
};

export const IngredientsList: React.FC<IngredientsListProps> = ({
  ingredients,
}) => {
  return (
    <Surface style={styles.container} elevation={1}>
      <Text variant="titleLarge" style={styles.title}>
        材料
      </Text>
      <FlatList
        data={ingredients}
        keyExtractor={(item, index) => `ingredient-${index}`}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            right={() => <Text style={styles.amount}>{item.amount}</Text>}
            style={styles.item}
          />
        )}
        scrollEnabled={false}
      />
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  title: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    fontWeight: "bold",
  },
  item: {
    paddingVertical: 4,
  },
  amount: {
    paddingRight: 16,
    opacity: 0.8,
  },
});
