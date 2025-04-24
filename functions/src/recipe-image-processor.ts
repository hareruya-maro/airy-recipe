import { vertexAI } from "@genkit-ai/vertexai";
import cors from "cors";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import { genkit } from "genkit";
import * as path from "path";
import { z } from "zod";

// CORS設定
const corsHandler = cors({ origin: true });

// プロジェクト設定
const PROJECT_ID = "airy-recipe";
const LOCATION = "us-central1";

// Genkitの初期化
const ai = genkit({
  plugins: [
    vertexAI({
      projectId: PROJECT_ID,
      location: LOCATION,
    }),
  ],
  model: "vertexai/gemini-2.0-flash",
  // プロンプトファイルのパスを設定
  promptDir: path.join(__dirname, "prompts"),
});

/**
 * Zodスキーマ：材料の形式を定義
 */
const IngredientSchema = z.object({
  name: z.string().describe("材料の名前 (例: '薄力粉', '卵')"),
  amount: z.string().describe("材料の分量 (例: '100g', '大さじ2', '少々')"),
});

/**
 * Zodスキーマ：レシピ情報の形式を定義
 */
const RecipeSchema = z.object({
  title: z.string().describe("レシピのタイトル"),
  description: z.string().optional().describe("レシピの簡単な説明（任意）"),
  ingredients: z
    .array(IngredientSchema)
    .describe("材料のリスト。各材料には名前と分量を含める"),
  steps: z
    .array(z.string())
    .describe("調理手順のリスト。各ステップを文字列として配列に格納する"),
  prepTime: z.number().optional().describe("準備時間（分単位、任意）"),
  cookTime: z.number().optional().describe("調理時間（分単位、任意）"),
  totalTime: z
    .number()
    .optional()
    .describe("調理と準備の合計時間（分単位、任意）"),
  servings: z.number().optional().describe("何人前か（任意）"),
  difficulty: z
    .string()
    .optional()
    .describe("難易度（'簡単'、'普通'、'やや難しい'、'難しい'など）"),
  categories: z
    .array(z.string())
    .optional()
    .describe("レシピのカテゴリやタグ（例：'主菜'、'和食'など）"),
});

// 型定義
type Recipe = z.infer<typeof RecipeSchema>;

// Firestoreへの登録に必要な入力情報の型定義
interface ExtractRecipeFlowInput {
  imageUrl: string;
  userId?: string;
}

// フローからの出力情報の型定義
interface ExtractRecipeFlowOutput {
  recipeId?: string;
  recipeData?: any;
  recipeInfo?: Recipe;
  imageUrl: string;
  success: boolean;
  error?: string;
}

/**
 * レシピ画像から情報を抽出し、Firestoreに登録するGenkitフロー
 */
const extractRecipeFlow = ai.defineFlow(
  {
    name: "extractRecipeFlow",
    inputSchema: z.object({
      imageUrl: z.string().url(),
      userId: z.string().optional(),
    }),
    outputSchema: z.object({
      recipeId: z.string().optional(),
      recipeData: z.any().optional(),
      recipeInfo: RecipeSchema.optional(),
      imageUrl: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
  },
  async (input: ExtractRecipeFlowInput): Promise<ExtractRecipeFlowOutput> => {
    logger.info(`レシピ抽出フロー開始: ${input.imageUrl}`);
    const userId = input.userId || "system";

    try {
      // .promptファイルを読み込み
      const recipePrompt = ai.prompt("recipeExtractor");

      // プロンプトを実行して画像URLを入力として渡す
      const { output } = await recipePrompt({ imageUrl: input.imageUrl });

      if (!output) {
        logger.warn("モデルから有効な構造化出力が得られませんでした。");
        return {
          imageUrl: input.imageUrl,
          success: false,
          error: "画像からレシピ情報を抽出できませんでした",
        };
      }

      logger.info("レシピ抽出成功:", output.title);
      const recipeInfo = output as Recipe;

      // Firestoreにレシピを保存
      try {
        const db = admin.firestore();

        // レシピのメインデータを準備
        const recipeData = {
          title: recipeInfo.title || "タイトルなし",
          description: recipeInfo.description || "OCRで抽出されたレシピです。",
          prepTime: recipeInfo.prepTime ?? 15,
          cookTime: recipeInfo.cookTime ?? 30,
          totalTime:
            recipeInfo.totalTime ??
            (recipeInfo.prepTime ?? 15) + (recipeInfo.cookTime ?? 30),
          servings: recipeInfo.servings ?? 2,
          difficulty: recipeInfo.difficulty ?? "普通",
          image: input.imageUrl,
          tags: ["OCR抽出", ...(recipeInfo.categories ?? [])]
            .filter(Boolean)
            .slice(0, 10),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: userId,
          isPublic: false,
          isSystemRecipe: false,
        };

        logger.info("レシピデータ準備完了", recipeData);

        // レシピのメインドキュメントを作成
        const recipeRef = await db.collection("recipes").add(recipeData);
        const recipeId = recipeRef.id;

        // 材料サブコレクションの登録
        if (
          Array.isArray(recipeInfo.ingredients) &&
          recipeInfo.ingredients.length > 0
        ) {
          const batch = db.batch();

          recipeInfo.ingredients.forEach((ingredient, index) => {
            const ingredientRef = recipeRef.collection("ingredients").doc();

            // 材料名と分量を分解して保存
            let quantity = 0;
            let unit = "";

            if (ingredient.amount) {
              // 数値と単位を分離する処理
              const match = ingredient.amount.match(
                /(\d+\.?\d*|\.\d+)\s*([^\d]*)/
              );
              if (match) {
                quantity = parseFloat(match[1]) || 0;
                unit = match[2]?.trim() || "";
              } else {
                unit = ingredient.amount.trim();
              }
            }

            batch.set(ingredientRef, {
              name: ingredient.name || "不明な材料",
              quantity: quantity,
              unit: unit,
              order: index,
            });
          });

          await batch.commit();
          logger.info("材料情報の登録が完了しました");
        }

        // 手順サブコレクションの登録
        if (Array.isArray(recipeInfo.steps) && recipeInfo.steps.length > 0) {
          const batch = db.batch();

          recipeInfo.steps.forEach((step, index) => {
            const stepRef = recipeRef.collection("steps").doc();

            batch.set(stepRef, {
              order: index,
              instruction: step || "不明な手順",
              imageUrl: null,
              tip: null,
            });
          });

          await batch.commit();
          logger.info("調理手順の登録が完了しました");
        }

        // 処理ログを保存
        await db.collection("recipeProcessingLogs").add({
          userId,
          recipeId,
          imageUrl: input.imageUrl,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          result: {
            recipeId,
            recipeData,
            recipeInfo,
          },
        });

        logger.info("レシピ画像処理完了、レシピが登録されました", {
          recipeId,
        });

        // 成功結果を返す
        return {
          recipeId,
          recipeData,
          recipeInfo,
          imageUrl: input.imageUrl,
          success: true,
        };
      } catch (dbError) {
        // Firestore処理中のエラー
        logger.error("レシピデータ保存中にエラーが発生しました:", dbError);
        return {
          recipeInfo,
          imageUrl: input.imageUrl,
          success: false,
          error:
            dbError instanceof Error
              ? dbError.message
              : "データベース保存中にエラーが発生しました",
        };
      }
    } catch (error) {
      // レシピ抽出中のエラー
      logger.error("レシピ抽出中にエラーが発生しました:", error);
      return {
        imageUrl: input.imageUrl,
        success: false,
        error:
          error instanceof Error ? error.message : "不明なエラーが発生しました",
      };
    }
  }
);

/**
 * レシピ本の写真を解析してレシピ情報を抽出し、ユーザーのレシピとして登録する関数
 */
export const processRecipeImage = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      // POSTリクエストのみ受け付ける
      if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
      }

      // リクエストボディからデータを取得
      const { imageUrl, userId } = request.body;

      if (!imageUrl) {
        response.status(400).send({ error: "画像URLが提供されていません" });
        return;
      }

      logger.info("レシピ画像処理開始", { imageUrl, userId });

      try {
        // Genkitフローを使用してレシピ情報を抽出してFirestoreに保存
        const result = await extractRecipeFlow({ imageUrl, userId });

        if (!result.success) {
          response.status(400).send({
            success: false,
            error: result.error || "画像からレシピ情報を抽出できませんでした",
          });
          return;
        }

        // 応答を返す
        response.status(200).send({
          success: true,
          data: {
            recipeId: result.recipeId,
            recipeData: result.recipeData,
            recipeInfo: result.recipeInfo,
            imageUrl,
          },
        });
      } catch (error) {
        // エラー処理
        logger.error("レシピ画像処理エラー", error);
        response.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "不明なエラーが発生しました",
        });
      }
    } catch (error) {
      // エラー処理
      logger.error("レシピ画像処理エラー", error);
      response.status(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : "不明なエラーが発生しました",
      });
    }
  });
});
