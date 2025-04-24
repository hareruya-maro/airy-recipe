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
import cors from "cors";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { genkit } from "genkit";

import { enableFirebaseTelemetry } from "@genkit-ai/firebase";

enableFirebaseTelemetry();

// レシピ画像処理機能をインポート
import { processRecipeImage } from "./recipe-image-processor";

// Firebase Adminの初期化（storageBucketオプションを追加）
admin.initializeApp({
  databaseURL: "https://airy-recipe.firebaseio.com",
  storageBucket: "airy-recipe.firebasestorage.app", // バケット名を指定
});

// Firestoreの参照を取得
// const db = admin.firestore();

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

// レシピ画像処理関数をエクスポート
export { processRecipeImage };
