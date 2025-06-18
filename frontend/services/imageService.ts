import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import ImagePicker from "react-native-image-crop-picker";
import { auth, storage } from "../config/firebase";

// 画像サイズの最大値（幅/高さ）
const MAX_IMAGE_SIZE = 1200;
const JPEG_QUALITY = 85;

/**
 * 標準的な日時フォーマット文字列を生成する（yyyymmdd_hhmmss）
 * @returns フォーマット済み日時文字列
 */
const generateDateTimeString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(
    2,
    "0"
  )}${String(now.getMinutes()).padStart(2, "0")}${String(
    now.getSeconds()
  ).padStart(2, "0")}`;
};

/**
 * 標準的な画像保存パスを生成する
 * @param fileName ファイル名（拡張子含む）
 * @param customFolder カスタムフォルダ名（オプション）
 * @returns Firebase Storage用のパス
 */
const generateImagePath = (fileName: string, customFolder?: string): string => {
  const dateTimeStr = generateDateTimeString();
  const folder = customFolder || `recipe_images/${dateTimeStr}`;
  return `${folder}/${fileName}`;
};

/**
 * 画像をリサイズして圧縮する
 * @param uri 元の画像URI
 * @returns 処理後の画像URI
 */
const resizeAndCompressImage = async (
  uri: string
): Promise<{ uri: string; width: number; height: number }> => {
  try {
    // 画像を処理（リサイズ＆圧縮）
    const context = ImageManipulator.manipulate(uri);
    const imageRef = await context
      .resize({ width: MAX_IMAGE_SIZE, height: MAX_IMAGE_SIZE })
      .renderAsync();

    const manipResult = await imageRef.saveAsync({
      compress: JPEG_QUALITY / 100,
      format: SaveFormat.JPEG,
    });

    return {
      uri: manipResult.uri,
      width: manipResult.width,
      height: manipResult.height,
    };
  } catch (error) {
    console.error("画像処理エラー:", error);
    throw error;
  }
};

/**
 * Base64エンコードされたデータをBlobに変換する
 * @param dataUri Base64データURI
 * @returns Blobオブジェクト
 */
const dataURItoBlob = async (dataUri: string): Promise<Blob> => {
  // expo-file-systemを使用している場合はファイルをfetchする
  try {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Blob変換エラー:", error);
    throw error;
  }
};

/**
 * 画像をFirebase Storageにアップロードする
 * @param uri 画像のURI
 * @param path 保存先のパス（例: users/user123/profile.jpg）
 * @returns ダウンロードURL
 */
const uploadImageToStorage = async (
  uri: string,
  path: string
): Promise<string> => {
  try {
    // 画像をリサイズ・圧縮
    const processedImage = await resizeAndCompressImage(uri);

    // Blobに変換
    const blob = await dataURItoBlob(processedImage.uri);

    // Firebase Storageのリファレンスを作成
    const storageRef = storage.ref(path);

    // 画像をアップロード
    await storageRef.putFile(processedImage.uri);

    // ダウンロードURLを取得
    const downloadUrl = await storageRef.getDownloadURL();

    return downloadUrl;
  } catch (error) {
    console.error("画像アップロードエラー:", error);
    throw error;
  }
};

/**
 * ギャラリーから画像を選択する
 * @returns 選択した画像情報
 */
const pickFromGallery = async (): Promise<string | null> => {
  try {
    const image = await ImagePicker.openPicker({
      width: 1200,
      height: 1200,
      freeStyleCropEnabled: true,
      cropping: true,
      cropperCircleOverlay: false,
      // compressImageMaxWidth: 1200,
      // compressImageMaxHeight: 1200,
      compressImageQuality: 0.8,
      mediaType: "photo",
    });

    return image.path;
  } catch (error) {
    console.log("画像選択キャンセル", error);
    return null;
  }
};

/**
 * カメラで写真を撮影する
 * @returns 撮影した画像情報
 */
const takePhoto = async (): Promise<string | null> => {
  try {
    const image = await ImagePicker.openCamera({
      width: 1200,
      height: 1200,
      cropping: true,
      freeStyleCropEnabled: true,
      compressImageMaxWidth: 1200,
      compressImageMaxHeight: 1200,
      compressImageQuality: 0.8,
      mediaType: "photo",
    });

    return image.path;
  } catch (error) {
    console.log("写真撮影キャンセル", error);
    return null;
  }
};

/**
 * レシピの画像をアップロードする
 * @param recipeId レシピID
 * @param imageUri 画像URI
 * @param imageType 画像タイプ（'main' または 'step_X'）
 * @param customFolder カスタムフォルダパス（オプション）
 * @returns ダウンロードURL
 */
const uploadRecipeImage = async (
  recipeId: string,
  imageUri: string,
  imageType: string,
  customFolder?: string
): Promise<string> => {
  try {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("ログインしていません");
    }

    // 標準パスフォーマットを使用: recipe_images/年月日_時分秒/imageType.jpg
    const fileName = `${imageType}.jpg`;
    const path = generateImagePath(fileName, customFolder);

    return await uploadImageToStorage(imageUri, path);
  } catch (error) {
    console.error("レシピ画像アップロードエラー:", error);
    throw error;
  }
};

/**
 * Firebase Storageから画像を削除する
 * @param path 削除する画像のパス
 */
const deleteImage = async (url: string): Promise<void> => {
  try {
    // Firebase Storage URLからパスを抽出
    const urlObj = new URL(url);
    const path = decodeURIComponent(urlObj.pathname)
      .split("/o/")[1]
      .split("?")[0];

    if (!path) {
      throw new Error("画像パスの取得に失敗しました");
    }

    const imageRef = storage.ref(path);
    await imageRef.delete();
    console.log("画像を削除しました:", path);
  } catch (error) {
    console.error("画像削除エラー:", error);
    throw error;
  }
};

/**
 * 複数の画像をまとめてアップロードする
 * @param images アップロードする画像URIの配列
 * @param customFolder カスタムフォルダ名（オプション）
 * @param progressCallback アップロード進捗コールバック（オプション）
 * @returns アップロードされた画像URLの配列とフォルダパス
 */
const uploadMultipleImages = async (
  images: string[],
  customFolder?: string,
  progressCallback?: (index: number, progress: number) => void
): Promise<{ folder: string; urls: string[] }> => {
  try {
    // フォルダ名を生成
    const dateTimeStr = generateDateTimeString();
    const folder = customFolder || `recipe_images/${dateTimeStr}`;

    // 各画像をアップロード
    const uploadPromises = images.map(async (imageUri, index) => {
      // 画像をリサイズ・圧縮
      const processedImage = await resizeAndCompressImage(imageUri);

      // パス生成
      const fileName = `image_${index}.jpg`;
      const path = `${folder}/${fileName}`;

      // Firebase Storageにアップロード
      const storageRef = storage.ref(path);
      await storageRef.putFile(processedImage.uri);

      // 進捗コールバックがあれば呼び出す
      if (progressCallback) {
        progressCallback(index, 100);
      }

      // ダウンロードURLを取得
      const downloadUrl = await storageRef.getDownloadURL();

      return downloadUrl;
    });

    const downloadUrls = await Promise.all(uploadPromises);

    return {
      folder,
      urls: downloadUrls,
    };
  } catch (error) {
    console.error("複数画像アップロードエラー:", error);
    throw error;
  }
};

// エクスポートするサービス関数
export const imageService = {
  pickFromGallery,
  takePhoto,
  uploadRecipeImage,
  uploadMultipleImages,
  deleteImage,
  resizeAndCompressImage,
  generateDateTimeString,
  generateImagePath,
};
