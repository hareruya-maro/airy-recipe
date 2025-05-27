/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { gemini25FlashPreview0417, googleAI } from "@genkit-ai/googleai";
import * as admin from "firebase-admin";
import { DocumentReference, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import { genkit } from "genkit";

import {
  defineFirestoreRetriever,
  enableFirebaseTelemetry,
} from "@genkit-ai/firebase";

enableFirebaseTelemetry();

// レシピ画像処理機能をインポート
import { textEmbedding004, vertexAI as vai } from "@genkit-ai/vertexai";
import { processRecipeImage } from "./recipe-image-processor";

// Firebase Adminの初期化（storageBucketオプションを追加）
const app = admin.initializeApp({
  projectId: "airy-recipe",
  databaseURL: "https://airy-recipe.firebaseio.com",
  storageBucket: "airy-recipe.firebasestorage.app", // バケット名を指定
});

let firestore = getFirestore(app);

if (process.env.GCLOUD_SERVICE_ACCOUNT_CREDS) {
  const serviceAccountCreds = JSON.parse(
    process.env.GCLOUD_SERVICE_ACCOUNT_CREDS
  );
  const authOptions = { credentials: serviceAccountCreds };
  firestore.settings(authOptions);
}

// configure a Genkit instance
const ai = genkit({
  plugins: [googleAI(), vai()],
  model: gemini25FlashPreview0417, // set default model
});

const cookingTipsRetriever = defineFirestoreRetriever(ai, {
  name: "cookingTipsRetriever",
  firestore,
  collection: "cookingTips",
  contentField: (snap) => {
    return [
      {
        text: JSON.stringify({
          title: snap.get("name"),
          description: snap.get("description"),
          videoUrl: snap.get("media")[0].url,
        }),
      },
    ];
  }, // Field containing document content
  vectorField: "embedding", // Field containing vector embeddings
  embedder: textEmbedding004, // Embedder to generate embeddings
  distanceMeasure: "DOT_PRODUCT", // Default is 'COSINE'; other options: 'EUCLIDEAN', 'DOT_PRODUCT'
  metadataFields(snap) {
    return {
      name: snap.get("name"),
      description: snap.get("description"),
      url: snap.get("media")[0].url,
      imageUrl: snap.get("media")[0].thumbnailUrl,
    };
  },
});

// const CookingTipsSchema = ai.defineSchema(
//   "CookingTipsSchema",
//   z.object({
//     text: z.string(),
//     url: z.string(),
//   })
// );

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
6. 回答は200文字以内で簡潔にまとめてください
7. 提供したコンテキスト情報を優先的に使用してください
8. 提供されたリトリーバーの取得結果（docs）を最優先で参照してください
9. リトリーバーの取得結果にユーザーの質問に対する明確な答えが含まれている場合は、その情報を優先して回答として提示してください。関連情報の場合は、それを活用して回答を生成してください。
10. リトリーバーの結果にURLやイメージURLがある場合は、関連性が高ければ回答の最後に追加してください
11. 提供したコンテキストに該当する情報があり、タイトルやURLがある場合は、出力にタイトルやURLを含めてください

回答はユーザーが調理中に聞くことを想定して、簡潔で明確にしてください。
また、リトリーバーから提供された情報がある場合、それを優先して使用し、より具体的かつ正確な回答を心がけてください。
URLが提供されている場合は、ユーザーが参照できるように回答の最後に追加してください。
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
      const { text: input, recipeContext } = request.data;

      if (!input) {
        throw new Error("テキストが提供されていません");
      }

      logger.info("音声コマンド処理リクエスト", { text: input, recipeContext });

      // レシピのコンテキスト情報を準備
      const contextInfo = recipeContext
        ? `現在表示中のレシピ情報: ${JSON.stringify(recipeContext)}`
        : "特定のレシピのコンテキストはありません";

      // リトリーバーを使ってベクターストアを参照
      const docs = await ai.retrieve({
        retriever: cookingTipsRetriever,
        query: input,
        options: { limit: 50 },
      });

      // リトリーバーからの参照結果をLLMに渡して回答を生成する
      const llmResult = await ai.generate({
        prompt:
          RECIPE_ASSISTANT_PROMPT +
          `${contextInfo}\n\nユーザーの質問: ${input}`,
        docs,
        model: gemini25FlashPreview0417,
      });

      // 応答を返す
      return {
        success: true,
        response: llmResult.text,
        cookingTips: llmResult.data,
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

// レシピ画像処理関数をエクスポート
export { processRecipeImage };

import { FieldValue } from "firebase-admin/firestore";

// Change these values to match your Firestore config/schema
const indexConfig = {
  collection: "cookingTips",
  contentField: "text",
  vectorField: "embedding",
  embedder: textEmbedding004,
};

async function indexToFirestore(
  docRef: DocumentReference,
  name: string,
  description: string
) {
  const [embeddingName] = await Promise.all([
    ai.embed({
      embedder: indexConfig.embedder,
      content: name + "\n" + description,
    }),
  ]).then(([embeddingResult]) => [embeddingResult[0].embedding]);
  await docRef.update({
    [indexConfig.vectorField]: FieldValue.vector(embeddingName),
  });
}

export const embedder = onDocumentWritten(
  {
    document: "cookingTips/{documentId}",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (event) => {
    // event.data.after: 新しいドキュメントデータ
    // event.data.before: 以前のドキュメントデータ
    const afterData = event.data?.after?.data();
    if (!afterData) return;

    await indexToFirestore(
      firestore.doc("cookingTips/" + event.params.documentId),
      afterData.name,
      afterData.description
    );
  }
);
