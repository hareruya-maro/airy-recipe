import { vertexAI } from "@genkit-ai/vertexai";
import cors from "cors";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import * as fs from "fs";
import { genkit } from "genkit";
import fetch from "node-fetch";
import * as os from "os";
import * as path from "path";
import sharp from "sharp";
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
 * Zodスキーマ：料理写真領域の形式を定義
 */
const DishImageBoundsSchema = z.object({
  hasImage: z.boolean().describe("料理写真が画像内に存在するかどうか"),
  x: z.number().describe("料理写真の左上隅のX座標（相対値、0.0～1.0）"),
  y: z.number().describe("料理写真の左上隅のY座標（相対値、0.0～1.0）"),
  width: z.number().describe("料理写真の幅（相対値、0.0～1.0）"),
  height: z.number().describe("料理写真の高さ（相対値、0.0～1.0）"),
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
  dishImageBounds: DishImageBoundsSchema.describe("料理写真の境界ボックス情報"),
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
 * 画像URLから料理写真の領域を抽出する関数
 * @param imageUrl 元の画像URL
 * @param dishImageBounds 料理写真の境界ボックス情報
 * @returns 抽出された料理写真のStorageパス（または抽出失敗時はnull）
 */
async function extractDishImage(
  imageUrl: string,
  dishImageBounds: z.infer<typeof DishImageBoundsSchema>,
  recipeId: string
): Promise<string | null> {
  // 料理写真が存在しない場合はnullを返す
  if (!dishImageBounds.hasImage) {
    logger.info("料理写真が見つかりませんでした");
    return null;
  }

  try {
    // 一時ファイルパスを生成
    const tempLocalFile = path.join(os.tmpdir(), `original-${Date.now()}.jpg`);
    const tempCroppedFile = path.join(os.tmpdir(), `cropped-${Date.now()}.jpg`);

    // 画像をダウンロード
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `画像のダウンロードに失敗しました: ${response.statusText}`
      );
    }

    // 画像データをバッファに変換
    const imageBuffer = await response.buffer();

    // 一時ファイルに保存
    fs.writeFileSync(tempLocalFile, imageBuffer);

    // 画像メタデータを取得して実際のサイズを確認
    const metadata = await sharp(tempLocalFile).metadata();
    const imageWidth = metadata.width || 1;
    const imageHeight = metadata.height || 1;

    // 相対座標を絶対ピクセル座標に変換
    const left = Math.round(dishImageBounds.x * imageWidth);
    const top = Math.round(dishImageBounds.y * imageHeight);
    const width = Math.round(dishImageBounds.width * imageWidth);
    const height = Math.round(dishImageBounds.height * imageHeight);

    // 画像を切り抜く
    await sharp(tempLocalFile)
      .extract({ left, top, width, height })
      .toFile(tempCroppedFile);

    // Storageにアップロード
    const bucket = admin.storage().bucket();
    const storagePath = `recipe_images/dish-${recipeId}.jpg`;

    await bucket.upload(tempCroppedFile, {
      destination: storagePath,
      metadata: {
        contentType: "image/jpeg",
      },
    });

    // 一時ファイルを削除
    fs.unlinkSync(tempLocalFile);
    fs.unlinkSync(tempCroppedFile);

    // 公開URLを生成して返す
    const [url] = await bucket.file(storagePath).getSignedUrl({
      action: "read",
      expires: "03-01-2500", // 長期間有効
    });

    logger.info(`料理写真を正常に抽出し保存しました: ${storagePath}`);
    return url;
  } catch (error) {
    logger.error("料理写真の抽出中にエラーが発生しました:", error);
    return null;
  }
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
          prepTime: recipeInfo.prepTime ?? 0,
          cookTime: recipeInfo.cookTime ?? 0,
          totalTime:
            recipeInfo.totalTime ??
            (recipeInfo.prepTime ?? 0) + (recipeInfo.cookTime ?? 0),
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

        // 料理写真が存在する場合は抽出して保存
        let dishImageUrl = null;
        if (recipeInfo.dishImageBounds && recipeInfo.dishImageBounds.hasImage) {
          logger.info("料理写真の抽出を開始します");
          dishImageUrl = await extractDishImage(
            input.imageUrl,
            recipeInfo.dishImageBounds,
            recipeId
          );

          // 料理写真がうまく抽出できた場合、レシピのメイン画像として設定
          if (dishImageUrl) {
            await recipeRef.update({
              dishImage: dishImageUrl,
              // メイン画像も料理写真に置き換える（オプション）
              image: dishImageUrl,
            });
            logger.info("レシピのメイン画像を料理写真に更新しました");
          }
        }

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
          dishImageUrl,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          result: {
            recipeId,
            recipeData: {
              ...recipeData,
              dishImage: dishImageUrl,
            },
            recipeInfo,
          },
        });

        logger.info("レシピ画像処理完了、レシピが登録されました", {
          recipeId,
          hasDishImage: !!dishImageUrl,
        });

        // 成功結果を返す
        const updatedRecipeData = {
          ...recipeData,
          dishImage: dishImageUrl,
        };

        return {
          recipeId,
          recipeData: updatedRecipeData,
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
