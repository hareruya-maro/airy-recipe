import {
  defineFirestoreRetriever,
  enableFirebaseTelemetry,
} from "@genkit-ai/firebase";
import {
  gemini25FlashPreview0417,
  textEmbedding004,
  vertexAI as vai,
} from "@genkit-ai/vertexai";
import * as admin from "firebase-admin";
import {
  DocumentReference,
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCallGenkit } from "firebase-functions/v2/https";
import { genkit } from "genkit";
import * as path from "path";
import { z } from "zod";
import { processRecipeImage } from "./recipe-image-processor";

enableFirebaseTelemetry();

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
  plugins: [vai()],
  model: gemini25FlashPreview0417, // set default model
  // プロンプトファイルのパスを設定
  promptDir: path.join(__dirname, "prompts"),
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

// 音声コマンド用の入力スキーマを定義
const VoiceCommandInputSchema = ai.defineSchema(
  "VoiceCommandInput",
  z.object({
    text: z
      .string()
      .min(1, "テキストは必須です")
      .describe("ユーザーからの音声コマンドテキスト"),
    recipeContext: z
      .object({
        title: z.string().optional(),
        currentStep: z.object({
          id: z.string(), // 現在のステップID
          description: z.string(),
          image: z.string().optional().nullable(),
        }), // 現在のステップ内容（文字列）
        stepNumber: z.number().optional(), // 現在のステップ番号
        totalSteps: z.number().optional(), // 全ステップ数
        ingredients: z
          .array(z.object({ name: z.string(), amount: z.string() }))
          .optional(),
      })
      .optional()
      .describe("現在表示されているレシピのコンテキスト情報"),
  })
);

// Genkitフローの定義
const voiceCommandFlow = ai.defineFlow(
  {
    name: "voiceCommandFlow",
    inputSchema: VoiceCommandInputSchema,
  },
  async ({ text: input, recipeContext }) => {
    try {
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

      // .promptファイルを読み込み
      const recipeAssistant = ai.prompt("recipeAssistant");

      // プロンプトを実行して画像URLを入力として渡す
      // 複数画像に対応するため、配列で渡す
      const { output } = await recipeAssistant({
        userInput: input,
        contextInfo:
          contextInfo +
          "\n" + // コンテキスト情報を追加
          JSON.stringify(docs.map((doc) => doc.metadata)),
        docs,
      });

      // 応答を返す
      return {
        success: true,
        response: output.message,
        videoUrl: output.videoUrl,
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
 * 音声コマンドをLLMに送信して応答を得る関数
 */
export const processVoiceCommand = onCallGenkit(
  {
    maxInstances: 10,
    secrets: ["GEMINI_API_KEY"],
  },
  voiceCommandFlow
);

// レシピ画像処理関数をエクスポート
export { processRecipeImage };

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
