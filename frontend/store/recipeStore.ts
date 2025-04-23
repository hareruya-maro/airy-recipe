import { create } from "zustand";
import { auth } from "../config/firebase";
import {
  Ingredient as FirestoreIngredient,
  Recipe as FirestoreRecipe,
  Step as FirestoreStep,
  recipeService,
  RecipeUpdate,
} from "../services/recipeService";

// 会話履歴のメッセージ型
export type ConversationMessage = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
};

// フロントエンドで使用するレシピ型（JSONとFirestoreの互換性を保つ）
export type Recipe = {
  id: string;
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  difficulty: string;
  image: string;
  ingredients: {
    name: string;
    amount: string;
  }[];
  steps: {
    id: string;
    description: string;
    image?: string;
  }[];
  tips?: string[];
  tags: string[];
  createdBy?: string;
  isSystemRecipe?: boolean;
  isPublic?: boolean;
};

type RecipeState = {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  currentStepIndex: number;
  isLoadingRecipes: boolean;
  isVoiceListening: boolean;
  recognizedText: string;
  lastAIResponse: string | null;
  conversationHistory: ConversationMessage[];
  isDialogVisible: boolean;

  // データ取得アクション
  fetchRecipes: () => Promise<void>;
  fetchRecipeDetails: (recipeId: string) => Promise<Recipe>;

  // レシピ関連アクション
  setCurrentRecipe: (recipe: Recipe) => void;
  updateRecipe: (recipeId: string, updates: RecipeUpdate) => Promise<boolean>;

  // ステップナビゲーション
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (index: number) => void;

  // 音声認識関連アクション
  setVoiceListening: (isListening: boolean) => void;
  setRecognizedText: (text: string) => void;
  setLastAIResponse: (response: string | null) => void;

  // 会話履歴関連アクション
  addConversationMessage: (text: string, isUser: boolean) => void;

  // ダイアログ表示状態
  setDialogVisible: (visible: boolean) => void;

  // セッションリセット
  resetCookingSession: () => void;
};

// FirestoreのデータをフロントエンドのRecipe型に変換する関数
const convertFirestoreRecipe = (
  firestoreRecipe: FirestoreRecipe,
  firestoreIngredients: FirestoreIngredient[],
  firestoreSteps: FirestoreStep[]
): Recipe => {
  return {
    id: firestoreRecipe.id,
    title: firestoreRecipe.title,
    description: firestoreRecipe.description,
    prepTime:
      typeof firestoreRecipe.prepTime === "number"
        ? `${firestoreRecipe.prepTime}分`
        : firestoreRecipe.prepTime,
    cookTime:
      typeof firestoreRecipe.cookTime === "number"
        ? `${firestoreRecipe.cookTime}分`
        : firestoreRecipe.cookTime,
    servings: firestoreRecipe.servings,
    difficulty: firestoreRecipe.difficulty,
    image: firestoreRecipe.image || "",
    ingredients: firestoreIngredients.map((ing) => ({
      name: ing.name,
      amount: ing.quantity
        ? `${ing.quantity}${ing.unit || ""}`
        : ing.unit || "",
    })),
    steps: firestoreSteps.map((step) => ({
      id: step.order.toString(),
      description: step.instruction,
      image: step.imageUrl,
    })),
    tips: [], // Firestoreのデータモデルに追加する場合は修正
    tags: firestoreRecipe.tags || [],
    createdBy: firestoreRecipe.createdBy,
    isSystemRecipe: firestoreRecipe.isSystemRecipe,
    isPublic: firestoreRecipe.isPublic,
  };
};

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  currentRecipe: null,
  currentStepIndex: 0,
  isLoadingRecipes: false,
  isVoiceListening: false,
  recognizedText: "",
  lastAIResponse: null,
  conversationHistory: [],
  isDialogVisible: false,

  // Firestoreからレシピを取得
  fetchRecipes: async () => {
    set({ isLoadingRecipes: true });
    try {
      const userId = auth.currentUser?.uid || null;

      // ユーザーがログインしている場合のみレシピを取得
      // 未ログインの場合は空の配列を返す
      const firestoreRecipes = userId
        ? await recipeService.getAccessibleRecipes(userId)
        : [];

      // Firestoreのレシピを簡易版のRecipeオブジェクトに変換
      const recipes = firestoreRecipes.map(
        (recipe) =>
          ({
            id: recipe.id,
            title: recipe.title,
            description: recipe.description,
            prepTime:
              typeof recipe.prepTime === "number"
                ? `${recipe.prepTime}分`
                : recipe.prepTime,
            cookTime:
              typeof recipe.cookTime === "number"
                ? `${recipe.cookTime}分`
                : recipe.cookTime,
            servings: recipe.servings,
            difficulty: recipe.difficulty,
            image: recipe.image || "",
            ingredients: [], // 詳細取得時に設定
            steps: [], // 詳細取得時に設定
            tips: [], // 詳細取得時に設定（現在未サポート）
            tags: recipe.tags || [],
            createdBy: recipe.createdBy,
            isSystemRecipe: recipe.isSystemRecipe,
            isPublic: recipe.isPublic,
          } as Recipe)
      );

      set({ recipes, isLoadingRecipes: false });
    } catch (error) {
      console.error("レシピ取得エラー:", error);
      set({ isLoadingRecipes: false });
    }
  },

  // レシピ詳細を取得（材料と手順を含む）
  fetchRecipeDetails: async (recipeId) => {
    try {
      const {
        recipe: firestoreRecipe,
        ingredients: firestoreIngredients,
        steps: firestoreSteps,
      } = await recipeService.getRecipeDetails(recipeId);

      // レシピ詳細をフロントエンド用の形式に変換
      const recipe = convertFirestoreRecipe(
        firestoreRecipe,
        firestoreIngredients,
        firestoreSteps
      );

      // 現在のレシピを設定
      set({ currentRecipe: recipe });

      // レシピリストも更新
      set((state) => ({
        recipes: state.recipes.map((r) => (r.id === recipe.id ? recipe : r)),
      }));

      return recipe;
    } catch (error) {
      console.error("レシピ詳細取得エラー:", error);
      throw error;
    }
  },

  // レシピ関連アクション
  setCurrentRecipe: (recipe) =>
    set({
      currentRecipe: recipe,
      currentStepIndex: 0,
    }),

  updateRecipe: async (recipeId, updates) => {
    try {
      await recipeService.updateRecipe(recipeId, updates);
      set((state) => ({
        recipes: state.recipes.map((recipe) =>
          recipe.id === recipeId ? { ...recipe, ...updates } : recipe
        ),
        currentRecipe:
          state.currentRecipe?.id === recipeId
            ? { ...state.currentRecipe, ...updates }
            : state.currentRecipe,
      }));
      return true;
    } catch (error) {
      console.error("レシピ更新エラー:", error);
      return false;
    }
  },

  // ステップナビゲーション
  nextStep: () =>
    set((state) => {
      if (!state.currentRecipe) return state;
      const maxSteps = state.currentRecipe.steps.length - 1;
      return {
        currentStepIndex:
          state.currentStepIndex >= maxSteps
            ? maxSteps
            : state.currentStepIndex + 1,
      };
    }),

  previousStep: () =>
    set((state) => ({
      currentStepIndex:
        state.currentStepIndex <= 0 ? 0 : state.currentStepIndex - 1,
    })),

  goToStep: (index) =>
    set((state) => {
      if (!state.currentRecipe) return state;
      const maxSteps = state.currentRecipe.steps.length - 1;
      const safeIndex = Math.max(0, Math.min(index, maxSteps));
      return { currentStepIndex: safeIndex };
    }),

  // 音声認識関連アクション
  setVoiceListening: (isListening) => set({ isVoiceListening: isListening }),
  setRecognizedText: (text) => set({ recognizedText: text }),
  setLastAIResponse: (response) => set({ lastAIResponse: response }),

  // 会話履歴関連アクション
  addConversationMessage: (text, isUser) =>
    set((state) => ({
      conversationHistory: [
        ...state.conversationHistory,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          text,
          isUser,
          timestamp: new Date(),
        },
      ],
    })),

  // ダイアログ表示状態の設定
  setDialogVisible: (visible) => set({ isDialogVisible: visible }),

  // セッションリセット
  resetCookingSession: () =>
    set({
      currentStepIndex: 0,
      recognizedText: "",
      lastAIResponse: null,
      conversationHistory: [],
      isDialogVisible: false,
    }),
}));
