// 元のJSONデータ構造に対応する型定義
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
