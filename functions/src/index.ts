/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { gemini20Flash, googleAI } from "@genkit-ai/googleai";
import { Content, VertexAI } from "@google-cloud/vertexai";
import * as vision from "@google-cloud/vision";
import cors from "cors";
import * as logger from "firebase-functions/logger";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { genkit } from "genkit";

// configure a Genkit instance
const ai = genkit({
  plugins: [googleAI()],
  model: gemini20Flash, // set default model
});
// CORS設定
const corsHandler = cors({ origin: true });

// Vertex AI初期化
const PROJECT_ID = "airy-recipe"; // GCPプロジェクトIDを設定してください
const LOCATION = "us-central1"; // リージョンを設定
const MODEL_ID = "gemini-2.0-flash"; // 使用するモデルID

// レシピアシスタントの基本プロンプト（システムプロンプト）
const RECIPE_ASSISTANT_PROMPT = `
あなたは料理アシスタントのAIです。
ユーザーは料理中でレシピアプリ「Airy Recipe」を使用しています。
彼らは音声コマンドであなたに話しかけています。
以下のことを念頭に置いてください：

1. 料理に関する質問に丁寧かつ簡潔に答えてください
2. 材料の代替品、調理テクニック、タイミングなどの質問に答えられます
3. 現在表示されているレシピのコンテキストを考慮して回答してください
4. 必要な情報がない場合は、料理の一般的な知識に基づいて回答してください
5. 回答は明確で、調理中のユーザーにとって役立つものにしてください
6. 回答は100文字以内で簡潔にまとめてください

回答はユーザーが調理中に聞くことを想定して、簡潔で明確にしてください。
`;

// Vertex AI クライアントの初期化
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const generativeModel = vertexAI.getGenerativeModel({
  model: MODEL_ID,
  systemInstruction: {
    role: "system",
    parts: [{ text: RECIPE_ASSISTANT_PROMPT }],
  },
});

// Cloud Vision API クライアントの初期化
const visionClient = new vision.ImageAnnotatorClient({
  projectId: PROJECT_ID,
});

/**
 * レシピ画像解析のためのプロンプト
 */
const RECIPE_EXTRACTION_PROMPT = `
与えられたレシピテキストから、以下の情報を抽出してJSON形式で返してください。

- タイトル
- 材料（材料名と分量をセットで）
- 作り方（手順を箇条書きで）

レシピテキスト:
\`\`\`
{{OCR_TEXT}}
\`\`\`

次の形式でJSON応答を返してください:
{
  "title": "レシピのタイトル",
  "ingredients": [
    { "name": "材料名1", "amount": "分量1" },
    { "name": "材料名2", "amount": "分量2" }
  ],
  "steps": [
    "手順1",
    "手順2"
  ]
}

不明な情報や抽出できない部分がある場合は、その項目を空にせず、可能な限り推測して値を入れてください。
`;

/**
 * 音声コマンドをLLMに送信して応答を得る関数
 */
export const processVoiceCommand = onCall(
  {
    maxInstances: 10,
    secrets: ["GEMINI_API_KEY"],
  },
  async (request) => {
    try {
      // リクエストデータの取得
      const { text, recipeContext } = request.data;

      console.log("LLM処理開始:", { text, recipeContext });

      if (!text) {
        throw new Error("テキストが提供されていません");
      }

      logger.info("音声コマンド処理リクエスト", { text, recipeContext });

      // レシピのコンテキスト情報を準備
      const contextInfo = recipeContext
        ? `現在表示中のレシピ情報: ${JSON.stringify(recipeContext)}`
        : "特定のレシピのコンテキストはありません";

      // LLMに送信するメッセージの準備
      const messages: Content[] = [
        {
          role: "user",
          parts: [{ text: `${contextInfo}\n\nユーザーの質問: ${text}` }],
        },
      ];

      // 生成AIモデルに問い合わせ
      const result = await generativeModel.generateContent({
        contents: messages,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
        },
      });

      const { text: testResult } = await ai.generate(
        RECIPE_ASSISTANT_PROMPT + `${contextInfo}\n\nユーザーの質問: ${text}`
      );

      console.log("LLM応答:", testResult);

      // レスポンスを取得
      const response = result.response;
      const aiResponse = response.candidates?.[0].content.parts[0].text;

      logger.info("LLM応答生成完了", { aiResponse });

      // 応答を返す
      return {
        success: true,
        response: aiResponse,
      };
    } catch (error) {
      // エラー処理
      logger.error("LLM処理エラー", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "不明なエラーが発生しました",
      };
    }
  }
);

/**
 * HTTP経由でLLMにアクセスするためのエンドポイント
 * （フロントエンド開発中のテスト用）
 */
export const llmApi = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      // POSTリクエストのみ受け付ける
      if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
      }

      // リクエストボディからデータを取得
      const { text, recipeContext } = request.body;

      if (!text) {
        response.status(400).send({ error: "テキストが提供されていません" });
        return;
      }

      // レシピのコンテキスト情報を準備
      const contextInfo = recipeContext
        ? `現在表示中のレシピ情報: ${JSON.stringify(recipeContext)}`
        : "特定のレシピのコンテキストはありません";

      // LLMに送信するメッセージの準備
      const messages: Content[] = [
        { role: "system", parts: [{ text: RECIPE_ASSISTANT_PROMPT }] },
        {
          role: "user",
          parts: [{ text: `${contextInfo}\n\nユーザーの質問: ${text}` }],
        },
      ];

      // 生成AIモデルに問い合わせ
      const result = await generativeModel.generateContent({
        contents: messages,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
        },
      });

      // レスポンスを取得
      const response_text =
        result.response.candidates?.[0].content.parts[0].text;

      // 応答を返す
      response.status(200).send({ success: true, response: response_text });
    } catch (error) {
      // エラー処理
      logger.error("LLM APIエラー", error);
      response.status(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : "不明なエラーが発生しました",
      });
    }
  });
});

/**
 * レシピ本の写真を解析してレシピ情報と料理写真を抽出する関数
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
      const { imageUrl } = request.body;

      if (!imageUrl) {
        response.status(400).send({ error: "画像URLが提供されていません" });
        return;
      }

      logger.info("レシピ画像処理開始", { imageUrl });

      try {
        // 1. 画像オブジェクト検出（料理や調理器具の検出）
        const [objectDetectionResult] = await visionClient.objectLocalization!({
          image: { source: { imageUri: imageUrl } },
        });

        const objects = objectDetectionResult.localizedObjectAnnotations || [];

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
          }
        );

        const fullText = textDetectionResult.fullTextAnnotation?.text || "";

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

        // 5. 最終的な結果を構築
        const finalResult = {
          recipeInfo,
          foodImages,
          rawText: fullText,
          imageUrl,
        };

        logger.info("レシピ画像処理完了");

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
