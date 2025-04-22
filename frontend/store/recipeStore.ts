import { create } from "zustand";
import sampleRecipes from "../assets/data/sample-recipes.json";

export type Ingredient = {
  name: string;
  amount: string;
};

export type Step = {
  id: string;
  description: string;
  image?: string; // 手順の画像URL（オプショナル）
};

export type Recipe = {
  id: string;
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  difficulty: string;
  image: string;
  ingredients: Ingredient[];
  steps: Step[];
  tips: string[];
  tags: string[];
};

// 会話履歴のメッセージ型
export type ConversationMessage = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
};

type RecipeState = {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  currentStepIndex: number;
  isLoadingRecipes: boolean;
  isVoiceListening: boolean;
  recognizedText: string;
  lastAIResponse: string | null;
  conversationHistory: ConversationMessage[]; // 会話履歴
  isDialogVisible: boolean; // ダイアログ表示状態

  // アクション
  setCurrentRecipe: (recipe: Recipe) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (index: number) => void;
  setVoiceListening: (isListening: boolean) => void;
  setRecognizedText: (text: string) => void;
  setLastAIResponse: (response: string | null) => void;
  addConversationMessage: (text: string, isUser: boolean) => void; // 会話履歴にメッセージを追加
  setDialogVisible: (visible: boolean) => void; // ダイアログ表示状態を設定
  resetCookingSession: () => void;
};

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: sampleRecipes as Recipe[],
  currentRecipe: null,
  currentStepIndex: 0,
  isLoadingRecipes: false,
  isVoiceListening: false,
  recognizedText: "",
  lastAIResponse: null,
  conversationHistory: [], // 会話履歴の初期値
  isDialogVisible: false, // ダイアログ表示状態の初期値

  // レシピ関連アクション
  setCurrentRecipe: (recipe) =>
    set({
      currentRecipe: recipe,
      currentStepIndex: 0,
    }),

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
      conversationHistory: [], // 会話履歴もリセット
      isDialogVisible: false, // ダイアログ表示状態もリセット
    }),
}));
