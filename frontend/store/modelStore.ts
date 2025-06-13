import ExpoLlmMediapipe, {
  DownloadOptions,
  DownloadProgressEvent,
  NativeModuleSubscription,
} from "expo-llm-mediapipe";
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

  // アクション
  checkIfModelDownloaded: () => Promise<boolean>;
  fetchDownloadedModels: () => Promise<void>;
  showDownloadModal: () => void;
  hideDownloadModal: () => void;
  downloadModel: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  setupModelDownloadListener: () => NativeModuleSubscription;
  removeModelDownloadListener: (subscription: NativeModuleSubscription) => void;
};

export const useModelStore = create<ModelState>((set, get) => ({
  downloadedModels: [],
  isModelDownloading: false,
  downloadProgress: 0,
  isModelDownloadModalVisible: false,
  isModelDownloaded: false,
  lastMessage: "",

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
}));
