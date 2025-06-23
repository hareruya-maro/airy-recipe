import ExpoLlmMediapipe, {
  DownloadOptions,
  DownloadProgressEvent,
  NativeModuleSubscription,
} from "expo-llm-mediapipe";
import { LayoutAnimation } from "react-native";
import { create } from "zustand";

// モデルのURL（実際のプロジェクトのモデルURLに置き換えてください）
export const MODEL_URL =
  "https://firebasestorage.googleapis.com/v0/b/airy-recipe.firebasestorage.app/o/model%2Fgemma-3n-E2B-it-int4.task?alt=media&token=a99738cd-ee22-4ba1-85a4-4c106799f0f8";
export const MODEL_NAME = "gemma-3n-E2B-it-int4.task";

type ModelState = {
  downloadedModels: string[];
  isModelDownloading: boolean;
  downloadProgress: number;
  isModelDownloadModalVisible: boolean;
  isModelDownloaded: boolean;
  lastMessage: string;
  modelHandle: number | null; // モデルハンドルを追加
  isModelInitializing: boolean; // モデル初期化中フラグを追加
  showInitCompleteMessage: boolean; // 初期化完了メッセージの表示状態
  isModelInitializationFailed: boolean; // モデル初期化失敗フラグを追加
  modelInitializationErrorMessage: string; // モデル初期化エラーメッセージ
  isDeletingModel: boolean; // モデル削除中フラグを追加

  // アクション
  checkIfModelDownloaded: () => Promise<boolean>;
  fetchDownloadedModels: () => Promise<void>;
  showDownloadModal: () => void;
  hideDownloadModal: () => void;
  downloadModel: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  setupModelDownloadListener: () => NativeModuleSubscription;
  removeModelDownloadListener: (subscription: NativeModuleSubscription) => void;
  createModel: () => Promise<number | null>; // モデルを作成し、ハンドルを返す
  releaseModel: () => Promise<void>; // モデルを解放する
  hideInitCompleteMessage: () => void; // 初期化完了メッセージを非表示にする
  hideInitFailureMessage: () => void; // 初期化失敗メッセージを非表示にする
  deleteModel: () => Promise<boolean>; // モデルを削除する
};

export const useModelStore = create<ModelState>((set, get) => ({
  downloadedModels: [],
  isModelDownloading: false,
  downloadProgress: 0,
  isModelDownloadModalVisible: false,
  isModelDownloaded: false,
  lastMessage: "",
  modelHandle: null, // 初期値はnull
  isModelInitializing: false, // 初期値はfalse
  showInitCompleteMessage: false, // 初期値はfalse
  isModelInitializationFailed: false, // 初期値はfalse
  modelInitializationErrorMessage: "", // 初期値は空文字
  isDeletingModel: false, // 初期値はfalse

  // モデルがダウンロード済みかどうかを確認する
  checkIfModelDownloaded: async () => {
    try {
      const isDownloaded = await ExpoLlmMediapipe.isModelDownloaded(MODEL_NAME);
      console.log(
        `${MODEL_NAME}のダウンロード状態: ${
          isDownloaded ? "ダウンロード済み" : "未ダウンロード"
        }`
      );
      set({ isModelDownloaded: isDownloaded });
      return isDownloaded;
    } catch (e: any) {
      console.error(`モデル確認エラー: ${e.message}`);
      set({ lastMessage: `モデル確認エラー: ${e.message}` });
      return false;
    }
  },

  // ダウンロード済みのモデル一覧を取得する
  fetchDownloadedModels: async () => {
    try {
      const models = await ExpoLlmMediapipe.getDownloadedModels();
      set({ downloadedModels: models });

      // モデルがダウンロード済みかどうかも確認する
      const isModelInList = models.includes(MODEL_NAME);
      set({ isModelDownloaded: isModelInList });

      return;
    } catch (e: any) {
      console.error(`モデル一覧取得エラー: ${e.message}`);
      set({ lastMessage: `モデル一覧取得エラー: ${e.message}` });
    }
  },

  // モデルのダウンロードモーダルを表示する
  showDownloadModal: () => {
    set({ isModelDownloadModalVisible: true });
  },

  // モデルのダウンロードモーダルを非表示にする
  hideDownloadModal: () => {
    set({ isModelDownloadModalVisible: false });
  },

  // モデルをダウンロードする
  downloadModel: async () => {
    set({ isModelDownloading: true, downloadProgress: 0 });
    try {
      const options: DownloadOptions = { overwrite: false };
      await ExpoLlmMediapipe.downloadModel(MODEL_URL, MODEL_NAME, options);
      // イベントリスナーでダウンロードの進捗や完了を処理する
    } catch (e: any) {
      console.error(`モデルダウンロード開始エラー: ${e.message}`);
      set({
        lastMessage: `モデルダウンロード開始エラー: ${e.message}`,
        isModelDownloading: false,
      });
    }
  },

  // ダウンロードをキャンセルする
  cancelDownload: async () => {
    if (!get().isModelDownloading) return;

    try {
      await ExpoLlmMediapipe.cancelDownload(MODEL_NAME);
      set({ lastMessage: `${MODEL_NAME}のダウンロードをキャンセルしました` });
    } catch (e: any) {
      set({ lastMessage: `ダウンロードキャンセルエラー: ${e.message}` });
    }
  },

  // モデルダウンロードのイベントリスナーをセットアップする
  setupModelDownloadListener: () => {
    const downloadProgressListener = ExpoLlmMediapipe.addListener(
      "downloadProgress",
      (event: DownloadProgressEvent) => {
        if (event.modelName === MODEL_NAME) {
          if (event.status === "downloading") {
            set({
              isModelDownloading: true,
              downloadProgress: event.progress ?? 0,
            });
          } else {
            set({ isModelDownloading: false });

            if (event.status === "completed") {
              set({
                lastMessage: `${MODEL_NAME}のダウンロードが完了しました`,
                downloadProgress: 1,
                isModelDownloaded: true,
                isModelDownloadModalVisible: false, // ダウンロード完了時にモーダルを閉じる
              });
              // ダウンロード済みのモデル一覧を更新する
              get().fetchDownloadedModels();
            } else if (event.status === "error") {
              set({ lastMessage: `ダウンロードエラー: ${event.error}` });
            } else if (event.status === "cancelled") {
              set({
                lastMessage: `ダウンロードがキャンセルされました`,
                downloadProgress: 0,
              });
            }
          }
        }
      }
    );

    return downloadProgressListener;
  },

  // イベントリスナーを削除する
  removeModelDownloadListener: (subscription: NativeModuleSubscription) => {
    subscription.remove();
  },

  // モデルを作成し、ハンドルを返す
  createModel: async () => {
    try {
      // すでにモデルハンドルがある場合はそれを返す
      if (get().modelHandle !== null) {
        console.log(`既存のモデルハンドルを使用: ${get().modelHandle}`);
        return get().modelHandle;
      }

      console.log(`${MODEL_NAME}のモデル作成を開始`);
      // モデル初期化中フラグをセット
      set({ isModelInitializing: true });

      const handle = await ExpoLlmMediapipe.createModelFromDownloaded(
        MODEL_NAME,
        1024, // maxTokens
        40, // topK
        0.7, // temperature
        42 // seed
      );

      console.log(`モデルが作成されました。ハンドル: ${handle}`);
      LayoutAnimation.easeInEaseOut();
      set({
        modelHandle: handle,
        isModelInitializing: false,
        showInitCompleteMessage: true, // 初期化完了メッセージを表示
      });

      // 2秒後に初期化完了メッセージを非表示にする
      setTimeout(() => {
        LayoutAnimation.easeInEaseOut();
        set({ showInitCompleteMessage: false });
      }, 2000);

      return handle;
    } catch (e: any) {
      console.error(`モデル作成エラー: ${e.message}`);
      set({
        lastMessage: `モデル作成エラー: ${e.message}`,
        isModelInitializing: false,
        isModelInitializationFailed: true,
        modelInitializationErrorMessage: e.message,
      });

      return null;
    }
  },

  // モデルを解放する
  releaseModel: async () => {
    const { modelHandle } = get();
    if (modelHandle !== null) {
      try {
        await ExpoLlmMediapipe.releaseModel(modelHandle);
        console.log(`モデルが解放されました。ハンドル: ${modelHandle}`);
        set({ modelHandle: null });
      } catch (e: any) {
        console.error(`モデル解放エラー: ${e.message}`);
        set({ lastMessage: `モデル解放エラー: ${e.message}` });
      }
    }
  },

  // 初期化完了メッセージを非表示にする
  hideInitCompleteMessage: () => {
    set({ showInitCompleteMessage: false });
  },

  // 初期化失敗メッセージを非表示にする
  hideInitFailureMessage: () => {
    LayoutAnimation.easeInEaseOut();
    set({ isModelInitializationFailed: false });
  },

  // モデルを削除する
  deleteModel: async () => {
    try {
      // モデルが現在使用中なら解放する
      if (get().modelHandle !== null) {
        await get().releaseModel();
      }

      // 削除中フラグを設定
      set({ isDeletingModel: true, lastMessage: "モデルを削除しています..." });

      // モデルの削除（適切なAPIで置き換える）
      await ExpoLlmMediapipe.deleteDownloadedModel(MODEL_NAME);

      console.log(`${MODEL_NAME}を削除しました`);

      // ステートをリセット
      set({
        isDeletingModel: false,
        isModelDownloaded: false,
        isModelInitializationFailed: false,
        modelInitializationErrorMessage: "",
        lastMessage: "モデルを削除しました。再ダウンロードできます。",
      });

      // モデル一覧を更新
      await get().fetchDownloadedModels();

      return true;
    } catch (e: any) {
      console.error(`モデル削除エラー: ${e.message}`);
      set({
        isDeletingModel: false,
        lastMessage: `モデル削除エラー: ${e.message}`,
      });
      return false;
    }
  },
}));
