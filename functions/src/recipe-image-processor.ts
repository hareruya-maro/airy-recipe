import { Content, VertexAI } from "@google-cloud/vertexai";
import * as vision from "@google-cloud/vision";
import cors from "cors";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";

// CORS設定
const corsHandler = cors({ origin: true });

// Vertex AI初期化
const PROJECT_ID = "airy-recipe"; // GCPプロジェクトIDを設定してください
const LOCATION = "us-central1"; // リージョンを設定
const MODEL_ID = "gemini-2.0-flash"; // 使用するモデルID

// Vertex AI クライアントの初期化
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const generativeModel = vertexAI.getGenerativeModel({
  model: MODEL_ID,
});

// Cloud Vision API クライアントの初期化
const visionClient = new vision.ImageAnnotatorClient({
  projectId: PROJECT_ID,
});

/**
 * レシピ画像解析のためのプロンプト
 */
const RECIPE_EXTRACTION_PROMPT = `
あなたは料理本の写真からレシピ情報を抽出する専門AIです。与えられたテキストから、可能な限り詳細なレシピ情報を抽出してJSON形式で返してください。

## 抽出する情報
1. タイトル（レシピ名）
2. 説明文（レシピの簡単な説明や特徴）
3. 材料（各材料の名前と分量）
4. 調理手順（順番に沿った手順）
5. 準備時間（分単位）
6. 調理時間（分単位）
7. 完成までの合計時間（分単位）
8. 何人前か（人数）
9. 難易度（「簡単」「普通」「やや難しい」「難しい」などで評価）
10. カテゴリ/タグ（「主菜」「副菜」「スープ」「デザート」などのカテゴリや、「和食」「洋食」「中華」などの料理ジャンル）

## 入力テキスト
\`\`\`
{{OCR_TEXT}}
\`\`\`

## 返却形式
JSONオブジェクトとして以下の形式で情報を返してください:

\`\`\`json
{
  "title": "レシピのタイトル",
  "description": "レシピの簡単な説明",
  "prepTime": 15,
  "cookTime": 30,
  "totalTime": 45,
  "servings": 4,
  "difficulty": "簡単",
  "ingredients": [
    { "name": "材料名1", "amount": "分量1" },
    { "name": "材料名2", "amount": "分量2" }
  ],
  "steps": [
    "手順1の説明",
    "手順2の説明"
  ],
  "categories": ["主菜", "和食"]
}
\`\`\`

## 注意事項
- 抽出できない項目があっても必ずJSONのキーは残し、適切な推測値かnullを設定してください
- 数値項目（時間や人数など）は数値型で返してください
- 調理時間や準備時間が「約30分」のように書かれている場合は、数字部分だけを抽出してください
- 材料の分量が「大さじ1」「少々」などの場合はそのまま記載してください
- レシピに書かれている情報を優先し、書かれていない場合のみ合理的な推測を行ってください
- 推測が難しい場合は、以下のデフォルト値を使用してください:
  - prepTime: 15（分）
  - cookTime: 30（分）
  - totalTime: 45（分）
  - servings: 2（人前）
  - difficulty: "普通"

テキストを注意深く分析し、できるだけ正確にレシピ情報を抽出してください。
`;

/**
 * レシピ本の写真を解析してレシピ情報と料理写真を抽出し、ユーザーのレシピとして登録する関数
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
        // 1. 画像オブジェクト検出（料理や調理器具の検出）
        const [objectDetectionResult] = await visionClient.objectLocalization!({
          image: { source: { imageUri: imageUrl } },
        });

        const objects = objectDetectionResult.localizedObjectAnnotations || [];
        logger.info("objects", objects);

        // 料理や調理関連のオブジェクトをフィルタリング
        const foodRelatedLabels = [
          "Food",
          "Dish",
          "Cookware",
          "Tableware",
          "Meal",
          "Dessert",
          "Fruit",
          "Vegetable",
        ];
        const foodObjects = objects.filter((obj) =>
          foodRelatedLabels.some((label) =>
            obj.name?.toLowerCase().includes(label.toLowerCase())
          )
        );

        // 2. OCR処理でテキスト抽出
        const [textDetectionResult] = await visionClient.documentTextDetection!(
          {
            image: { source: { imageUri: imageUrl } },
            imageContext: {
              languageHints: ["ja"],
              enableTextDetectionConfidenceScore: true,
            },
          }
        );

        const fullText = textDetectionResult.fullTextAnnotation?.text || "";
        logger.info("fullText", fullText);

        if (!fullText) {
          response
            .status(400)
            .send({ error: "画像からテキストを抽出できませんでした" });
          return;
        }

        // 3. Gemini APIを使ったレシピテキストの解析
        const prompt = RECIPE_EXTRACTION_PROMPT.replace(
          "{{OCR_TEXT}}",
          fullText
        );

        // Vertex AIを使用してレシピ情報を抽出
        const messages: Content[] = [
          { role: "user", parts: [{ text: prompt }] },
        ];

        const generationResult = await generativeModel.generateContent({
          contents: messages,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.2,
          },
        });

        const responseText =
          generationResult.response.candidates?.[0].content.parts[0].text || "";

        logger.info("responseText", responseText);

        // JSONレスポンスをパース
        let recipeInfo;
        try {
          // Geminiからの応答をJSON形式に変換
          // JSONブロックを抽出する正規表現
          const jsonMatch = responseText.match(
            /```json\s*([\s\S]*?)\s*```|({[\s\S]*})/
          );
          const jsonString = jsonMatch
            ? jsonMatch[1] || jsonMatch[0]
            : responseText;

          recipeInfo = JSON.parse(jsonString.replace(/```/g, "").trim());
        } catch (error) {
          logger.error("JSONパースエラー", error);
          recipeInfo = {
            title: "不明なレシピ",
            ingredients: [],
            steps: [],
            rawResponse: responseText,
          };
        }

        // 4. 検出された料理/調理写真の情報を構造化
        const foodImages = foodObjects.map((obj) => ({
          name: obj.name,
          confidence: obj.score,
          boundingBox: obj.boundingPoly?.normalizedVertices,
        }));

        // 5. Firestoreにレシピを保存
        const db = admin.firestore();
        const recipeData = {
          title: recipeInfo.title || "タイトルなし",
          description:
            recipeInfo.description ||
            `OCRで抽出されたレシピです。${
              foodImages.length > 0
                ? `検出された食品: ${foodImages
                    .map((img) => img.name)
                    .join(", ")}`
                : ""
            }`,
          prepTime:
            typeof recipeInfo.prepTime === "number" ? recipeInfo.prepTime : 15,
          cookTime:
            typeof recipeInfo.cookTime === "number" ? recipeInfo.cookTime : 30,
          servings:
            typeof recipeInfo.servings === "number" ? recipeInfo.servings : 2,
          difficulty: recipeInfo.difficulty || "普通",
          image: imageUrl,
          tags: [
            "OCR抽出",
            ...(recipeInfo.categories || []),
            ...foodImages.map((img) => String(img.name)),
          ]
            .filter(Boolean)
            .slice(0, 10),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: userId || "system",
          isPublic: false,
          isSystemRecipe: false,
        };

        logger.info("recipeData", recipeData);
        // レシピのメインドキュメントを作成
        const recipeRef = await db.collection("recipes").add(recipeData);

        // 材料サブコレクションの登録
        if (
          Array.isArray(recipeInfo.ingredients) &&
          recipeInfo.ingredients.length > 0
        ) {
          const batch = db.batch();

          recipeInfo.ingredients.forEach((ingredient: any, index: number) => {
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

          logger.info("before batch.commit");
          await batch.commit();
        }

        // 手順サブコレクションの登録
        if (Array.isArray(recipeInfo.steps) && recipeInfo.steps.length > 0) {
          const batch = db.batch();

          recipeInfo.steps.forEach((step: any, index: number) => {
            const stepRef = recipeRef.collection("steps").doc();

            batch.set(stepRef, {
              order: index,
              instruction: step || "不明な手順",
              imageUrl: null,
              tip: null,
            });
          });

          logger.info("before batch.commit 2");
          await batch.commit();
        }

        // 6. 最終的な結果を構築
        const finalResult = {
          recipeId: recipeRef.id,
          recipeData,
          recipeInfo,
          foodImages,
          rawText: fullText,
          imageUrl,
        };

        logger.info("before recipeProcessingLogs");
        // 処理ログを保存
        await db.collection("recipeProcessingLogs").add({
          userId: userId || "anonymous",
          recipeId: recipeRef.id,
          imageUrl,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          result: finalResult,
        });

        logger.info("レシピ画像処理完了、レシピが登録されました", {
          recipeId: recipeRef.id,
        });

        // 応答を返す
        response.status(200).send({
          success: true,
          data: finalResult,
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
