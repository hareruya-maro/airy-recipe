import { create } from "zustand";

type ImageUploadState = {
  uploadedFolders: string[];
  uploadedUrls: { [folder: string]: string[] };
  lastUploadResult: { folder: string; urls: string[] } | null;

  // アクション
  addUploadResult: (result: { folder: string; urls: string[] }) => void;
  clearUploadHistory: () => void;
};

export const useImageUploadStore = create<ImageUploadState>((set) => ({
  uploadedFolders: [],
  uploadedUrls: {},
  lastUploadResult: null,

  // 新しいアップロード結果を追加
  addUploadResult: (result) =>
    set((state) => {
      const { folder, urls } = result;

      // フォルダが既に存在する場合は更新、そうでない場合は追加
      const folders = state.uploadedFolders.includes(folder)
        ? state.uploadedFolders
        : [...state.uploadedFolders, folder];

      return {
        uploadedFolders: folders,
        uploadedUrls: {
          ...state.uploadedUrls,
          [folder]: urls,
        },
        lastUploadResult: result,
      };
    }),

  // アップロード履歴をクリア
  clearUploadHistory: () =>
    set({
      uploadedFolders: [],
      uploadedUrls: {},
      lastUploadResult: null,
    }),
}));
