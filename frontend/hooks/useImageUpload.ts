import "react-native-get-random-values";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import { useWindowDimensions } from "react-native";
import ImagePicker from "react-native-image-crop-picker";
import { v4 as uuidv4 } from "uuid";
import { auth, storage } from "../config/firebase";

// 複数画像の情報を管理するための型
export type UploadImage = {
  id: string;
  uri: string;
  status: "pending" | "uploading" | "complete" | "error";
  progress?: number;
  downloadUrl?: string;
  width?: number;
  height?: number;
};

// レシピ処理結果の型
export type RecipeProcessingResult = {
  recipeId: string;
  recipeData: any;
  recipeInfo: any;
  foodImages: any[];
  rawText: string;
  imageUrl: string;
};

export const useImageUpload = () => {
  const [images, setImages] = useState<UploadImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipeResult, setRecipeResult] =
    useState<RecipeProcessingResult | null>(null);

  const { width, height } = useWindowDimensions();

  // 写真を撮影する
  const takePicture = async () => {
    try {
      // react-native-image-crop-pickerを使ってカメラを起動
      const result = await ImagePicker.openCamera({
        cropping: true,
        width: 1240,
        height: 1754,
        includeBase64: false,
        mediaType: "photo",
        compressImageQuality: 0.8,
        freeStyleCropEnabled: true,
      });

      if (result) {
        const newImage: UploadImage = {
          id: uuidv4(),
          uri: result.path,
          status: "pending",
          width: result.width,
          height: result.height,
        };
        setImages((prev) => [...prev, newImage]);
        return newImage;
      }

      return null;
    } catch (err: any) {
      // ユーザーがキャンセルした場合は静かに失敗
      if (err.toString().includes("User cancelled")) {
        return null;
      }

      setError("写真の撮影中にエラーが発生しました");
      console.error("Camera error:", err);
      return null;
    }
  };

  // ギャラリーから画像を選択
  const pickImage = async () => {
    try {
      // react-native-image-crop-pickerを使ってギャラリーを開く
      const results = await ImagePicker.openPicker({
        multiple: true,
        width: 1240,
        height: 1754,
        mediaType: "photo",
        compressImageQuality: 0.8,
        freeStyleCropEnabled: true,
      });

      if (results && results.length > 0) {
        const newImages: UploadImage[] = results.map((result) => ({
          id: uuidv4(),
          uri: result.path,
          status: "pending",
          width: result.width,
          height: result.height,
        }));
        setImages((prev) => [...prev, ...newImages]);
        return newImages;
      }

      return null;
    } catch (err: any) {
      // ユーザーがキャンセルした場合は静かに失敗
      if (err.toString().includes("User cancelled")) {
        return null;
      }

      setError("画像の選択中にエラーが発生しました");
      console.error("Image picker error:", err);
      return null;
    }
  };

  // 画像をトリミング
  const cropImage = async (imageUri: string) => {
    try {
      // react-native-image-crop-pickerを使って画像をトリミング
      const croppedImage = await ImagePicker.openCropper({
        mediaType: "photo",
        width: 1240,
        height: 1754,
        path: imageUri,
        freeStyleCropEnabled: true,
        cropperCircleOverlay: false,
        compressImageQuality: 0.8,
      });

      if (croppedImage) {
        // トリミング後の画像で元の画像を更新
        setImages((prevImages) =>
          prevImages.map((img) =>
            img.uri === imageUri
              ? {
                  ...img,
                  uri: croppedImage.path,
                  width: croppedImage.width,
                  height: croppedImage.height,
                }
              : img
          )
        );

        return croppedImage.path;
      }

      return null;
    } catch (err: any) {
      // ユーザーがキャンセルした場合は静かに失敗
      if (err.toString().includes("User cancelled")) {
        return imageUri; // 元の画像を返す
      }

      setError("画像のトリミング中にエラーが発生しました");
      console.error("Image cropping error:", err);
      return null;
    }
  };

  // 画像をFirebase Storageにアップロード
  const uploadImagesToFirebase = async (folderName?: string) => {
    try {
      setIsUploading(true);
      setError(null);

      // フォルダ名が指定されていない場合は現在のタイムスタンプを使用
      const folder = folderName || `recipe_images/${Date.now()}`;
      const uploadPromises = images.map(async (image, index) => {
        // アップロード中のステータスを更新
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, status: "uploading", progress: 0 }
              : img
          )
        );

        // 画像ファイルのBlobを取得
        const response = await fetch(image.uri);
        const blob = await response.blob();

        // FirebaseのStorageリファレンスを作成
        const imageRef = ref(storage, `${folder}/image_${index}.jpg`);

        // 画像をアップロード
        await uploadBytes(imageRef, blob);

        // ダウンロードURLを取得
        const downloadUrl = await getDownloadURL(imageRef);

        // 完了したステータスを更新
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, status: "complete", progress: 100, downloadUrl }
              : img
          )
        );

        return { id: image.id, downloadUrl };
      });

      const results = await Promise.all(uploadPromises);
      setIsUploading(false);

      return {
        folder,
        urls: results.map((r) => r.downloadUrl),
      };
    } catch (err) {
      setIsUploading(false);
      setError("画像のアップロード中にエラーが発生しました");
      console.error("Upload error:", err);
      return null;
    }
  };

  // 画像をアップロードして、レシピ処理関数を呼び出す
  const uploadAndProcessRecipeImage = async (folderName?: string) => {
    try {
      // 最初に画像をアップロード
      const uploadResult = await uploadImagesToFirebase(folderName);

      if (!uploadResult || uploadResult.urls.length === 0) {
        throw new Error("画像のアップロードに失敗しました");
      }

      // 処理を開始
      setIsProcessing(true);

      // 最初の画像を処理対象とする
      const imageUrl = uploadResult.urls[0];

      // 現在のユーザーIDを取得
      const userId = auth.currentUser?.uid || "anonymous";

      // Firebase Functions APIのURLを構築
      // 注: デプロイされているリージョンによって変更が必要な場合があります
      const region = "us-central1"; // デフォルトのFirebase Functionsのリージョン
      const projectId = "airy-recipe"; // firebase.tsのプロジェクトIDと一致させる
      const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/processRecipeImage`;

      // HTTP POSTリクエストを送信
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl,
          userId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `レシピ処理に失敗しました: ${errorText || response.statusText}`
        );
      }

      // レスポンスを解析
      const result = await response.json();

      if (!result.success) {
        throw new Error(`レシピ処理エラー: ${result.error || "不明なエラー"}`);
      }

      // 結果を状態に保存
      setRecipeResult(result.data);

      setIsProcessing(false);
      return result.data;
    } catch (err) {
      setIsProcessing(false);
      setError(
        err instanceof Error
          ? err.message
          : "レシピ処理中にエラーが発生しました"
      );
      console.error("Recipe processing error:", err);
      return null;
    }
  };

  // 画像リストをクリア
  const clearImages = () => {
    setImages([]);
    setError(null);
    setRecipeResult(null);
  };

  // 特定の画像を削除
  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  return {
    images,
    isUploading,
    isProcessing,
    recipeResult,
    error,
    takePicture,
    pickImage,
    cropImage,
    uploadImagesToFirebase,
    uploadAndProcessRecipeImage,
    clearImages,
    removeImage,
  };
};
