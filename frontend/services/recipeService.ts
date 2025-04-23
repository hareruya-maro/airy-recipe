import { or } from "firebase/firestore";
import {
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  where,
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
      console.log("レシピ詳細取得:", recipeId);
      // レシピのメインデータを取得
      const recipeRef = doc(db, "recipes", recipeId);
      const recipeSnap = await getDoc(recipeRef);

      if (!recipeSnap.exists()) {
        throw new Error("レシピが見つかりません");
      }

      const recipe = recipeSnap.data() as Recipe;

      console.log("材料を取得:", recipeId);
      // 材料を取得
      const ingredientsRef = collection(db, "recipes", recipeId, "ingredients");
      const ingredientsSnap = await getDocs(ingredientsRef);
      const ingredients = ingredientsSnap.docs.map(
        (doc) => doc.data() as Ingredient
      );

      console.log("手順を取得:", recipeId);
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
};
