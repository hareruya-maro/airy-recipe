import "react-native-get-random-values";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import ImagePicker from "react-native-image-crop-picker";
import { v4 as uuidv4 } from "uuid";
import { storage } from "../config/firebase";

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

export const useImageUpload = () => {
  const [images, setImages] = useState<UploadImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 写真を撮影する
  const takePicture = async () => {
    try {
      // react-native-image-crop-pickerを使ってカメラを起動
      const result = await ImagePicker.openCamera({
        cropping: true,
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

  // 画像リストをクリア
  const clearImages = () => {
    setImages([]);
    setError(null);
  };

  // 特定の画像を削除
  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  return {
    images,
    isUploading,
    error,
    takePicture,
    pickImage,
    cropImage,
    uploadImagesToFirebase,
    clearImages,
    removeImage,
  };
};
