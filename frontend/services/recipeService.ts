import { or } from "firebase/firestore";
import {
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "../config/firebase";

// Firestoreのレシピドキュメントの型定義
export interface Recipe {
  id: string;
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  difficulty: string;
  image: string;
  tags: string[];
  createdAt?: any;
  updatedAt?: any;
  createdBy: string;
  isPublic: boolean;
  isSystemRecipe: boolean;
}

// Firestoreの材料ドキュメントの型定義
export interface Ingredient {
  name: string;
  order: number;
  quantity: number;
  unit: string;
  note?: string;
}

// Firestoreの調理手順ドキュメントの型定義
export interface Step {
  order: number;
  instruction: string;
  imageUrl?: string;
  tip?: string;
}

// レシピ更新用のインターフェース（部分更新のため、すべてのフィールドがオプショナル）
export interface RecipeUpdate {
  title?: string;
  description?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  difficulty?: string;
  image?: string;
  tags?: string[];
  isPublic?: boolean;
  ingredients?: {
    name: string;
    quantity: number;
    unit: string;
    note?: string;
  }[];
  steps?: {
    instruction: string;
    imageUrl?: string;
    tip?: string;
  }[];
}

// レシピデータを取得するサービス
export const recipeService = {
  // すべてのレシピを取得
  getAllRecipes: async (): Promise<Recipe[]> => {
    try {
      const recipesRef = collection(db, "recipes");
      const recipesSnapshot = await getDocs(recipesRef);

      return recipesSnapshot.docs.map((doc) => {
        const data = doc.data() as Recipe;
        return {
          ...data,
          id: doc.id,
        };
      });
    } catch (error) {
      console.error("レシピ取得エラー:", error);
      return [];
    }
  },

  // ユーザーが閲覧可能なすべてのレシピを取得（システムレシピ + 自分のレシピ + 公開レシピ）
  getAccessibleRecipes: async (userId: string | null): Promise<Recipe[]> => {
    try {
      const recipesRef = collection(db, "recipes");
      const systemRecipesQuery = query(
        recipesRef,
        or(
          where("isSystemRecipe", "==", true),
          where("isPublic", "==", true),
          where("createdBy", "==", userId)
        )
      );
      const recipesSnapshot = await getDocs(systemRecipesQuery);

      return recipesSnapshot.docs
        .map((doc) => {
          const data = doc.data() as Recipe;
          return {
            ...data,
            id: doc.id,
          };
        })
        .filter(
          (recipe) =>
            recipe.isSystemRecipe ||
            recipe.createdBy === userId ||
            recipe.isPublic
        );
    } catch (error) {
      console.error("レシピ取得エラー:", error);
      return [];
    }
  },

  // システムレシピのみを取得
  getSystemRecipes: async (): Promise<Recipe[]> => {
    try {
      const recipesRef = collection(db, "recipes");
      const systemRecipesQuery = query(
        recipesRef,
        where("isSystemRecipe", "==", true)
      );
      const recipesSnapshot = await getDocs(systemRecipesQuery);

      return recipesSnapshot.docs.map((doc) => {
        const data = doc.data() as Recipe;
        return {
          ...data,
          id: doc.id,
        };
      });
    } catch (error) {
      console.error("システムレシピ取得エラー:", error);
      return [];
    }
  },

  // ユーザーのレシピを取得
  getUserRecipes: async (userId: string): Promise<Recipe[]> => {
    try {
      const recipesRef = collection(db, "recipes");
      const userRecipesQuery = query(
        recipesRef,
        where("createdBy", "==", userId)
      );
      const recipesSnapshot = await getDocs(userRecipesQuery);

      return recipesSnapshot.docs.map((doc) => {
        const data = doc.data() as Recipe;
        return {
          ...data,
          id: doc.id,
        };
      });
    } catch (error) {
      console.error("ユーザーレシピ取得エラー:", error);
      return [];
    }
  },

  // レシピの詳細を取得（材料と手順を含む）
  getRecipeDetails: async (
    recipeId: string
  ): Promise<{ recipe: Recipe; ingredients: Ingredient[]; steps: Step[] }> => {
    try {
      // レシピのメインデータを取得
      const recipeRef = doc(db, "recipes", recipeId);
      const recipeSnap = await getDoc(recipeRef);

      if (!recipeSnap.exists()) {
        throw new Error("レシピが見つかりません");
      }

      const recipe = recipeSnap.data() as Recipe;

      // 材料を取得
      const ingredientsRef = collection(db, "recipes", recipeId, "ingredients");
      const ingredientsSnap = await getDocs(ingredientsRef);
      const ingredients = ingredientsSnap.docs
        .map((doc) => doc.data() as Ingredient)
        .sort((a, b) => a.order - b.order);

      // 手順を取得
      const stepsRef = collection(db, "recipes", recipeId, "steps");
      const stepsSnap = await getDocs(stepsRef);
      const unsortedSteps = stepsSnap.docs.map((doc) => doc.data() as Step);

      // 手順を順番(order)でソート
      const steps = unsortedSteps.sort((a, b) => a.order - b.order);

      return {
        recipe: {
          ...recipe,
          id: recipeId,
        },
        ingredients,
        steps,
      };
    } catch (error: any) {
      console.error("レシピ詳細取得エラー:", error);
      throw error;
    }
  },

  // レシピを更新する
  updateRecipe: async (
    recipeId: string,
    updates: RecipeUpdate
  ): Promise<boolean> => {
    try {
      // 既存のレシピを取得して、ユーザーが更新できるレシピかチェック
      const recipeRef = doc(db, "recipes", recipeId);
      const recipeSnap = await getDoc(recipeRef);

      if (!recipeSnap.exists()) {
        throw new Error("レシピが見つかりません");
      }

      const recipe = recipeSnap.data() as Recipe;

      // システムレシピは更新できない
      if (recipe.isSystemRecipe) {
        throw new Error("システムレシピは編集できません");
      }

      // バッチ処理を使用して、レシピ本体と材料・手順を一度に更新
      const batch = writeBatch(db);

      // メインレシピドキュメントの更新
      const recipeUpdates: any = {
        updatedAt: serverTimestamp(),
      };

      // オプショナルフィールドの追加
      if (updates.title !== undefined) recipeUpdates.title = updates.title;
      if (updates.description !== undefined)
        recipeUpdates.description = updates.description;
      if (updates.prepTime !== undefined)
        recipeUpdates.prepTime = updates.prepTime;
      if (updates.cookTime !== undefined)
        recipeUpdates.cookTime = updates.cookTime;
      if (updates.servings !== undefined)
        recipeUpdates.servings = updates.servings;
      if (updates.difficulty !== undefined)
        recipeUpdates.difficulty = updates.difficulty;
      if (updates.image !== undefined) recipeUpdates.image = updates.image;
      if (updates.tags !== undefined) recipeUpdates.tags = updates.tags;
      if (updates.isPublic !== undefined)
        recipeUpdates.isPublic = updates.isPublic;

      // メインレシピの更新をバッチに追加
      batch.update(recipeRef, recipeUpdates);

      // 材料の更新
      if (updates.ingredients !== undefined) {
        // 既存の材料を削除するためにサブコレクションを取得
        const ingredientsRef = collection(
          db,
          "recipes",
          recipeId,
          "ingredients"
        );
        const ingredientsSnap = await getDocs(ingredientsRef);

        // 既存の材料をすべて削除
        ingredientsSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // 新しい材料を追加
        updates.ingredients.forEach((ingredient, index) => {
          const newIngredientRef = doc(
            collection(db, "recipes", recipeId, "ingredients")
          );
          batch.set(newIngredientRef, {
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            note: ingredient.note || "",
            order: index,
          });
        });
      }

      // 手順の更新
      if (updates.steps !== undefined) {
        // 既存の手順を削除するためにサブコレクションを取得
        const stepsRef = collection(db, "recipes", recipeId, "steps");
        const stepsSnap = await getDocs(stepsRef);

        // 既存の手順をすべて削除
        stepsSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // 新しい手順を追加
        updates.steps.forEach((step, index) => {
          const newStepRef = doc(collection(db, "recipes", recipeId, "steps"));
          batch.set(newStepRef, {
            instruction: step.instruction,
            imageUrl: step.imageUrl || null,
            tip: step.tip || null,
            order: index,
          });
        });
      }

      // バッチ処理の実行
      await batch.commit();

      return true;
    } catch (error: any) {
      console.error("レシピ更新エラー:", error);
      throw error;
    }
  },
};
