import { useRef, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  IconButton,
  Portal,
  ProgressBar,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import {
  RecipeProcessingResult,
  UploadImage,
  useImageUpload,
} from "../../hooks/useImageUpload";

export type RecipeImageUploaderProps = {
  onUploadComplete?: (result: { folder: string; urls: string[] }) => void;
  onRecipeProcessed?: (recipeResult: RecipeProcessingResult) => void;
};

export const RecipeImageUploader = ({
  onUploadComplete,
  onRecipeProcessed,
}: RecipeImageUploaderProps) => {
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [processingMode, setProcessingMode] = useState<"upload" | "process">(
    "upload"
  );
  const { colors } = useTheme();

  const {
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
  } = useImageUpload();

  const prevRecipeResultRef = useRef<RecipeProcessingResult | null>(null);

  const { width } = useWindowDimensions();
  const styles = makeStyle({ width });
  // スナックバーの表示

  // 写真を撮影
  const handleTakePicture = async () => {
    await takePicture();
  };

  // ギャラリーから選択
  const handlePickImage = async () => {
    await pickImage();
  };

  // 選択された画像をトリミング
  const handleCropSelectedImage = (imageUri: string) => {
    cropImage(imageUri);
  };

  // Firebase Storageにアップロードする（通常のアップロード）
  const handleUpload = async () => {
    if (images.length > 0) {
      // フォルダ名を生成（例：recipe_年月日_時分秒）
      const now = new Date();
      const folderName = `recipe_images/${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(
        now.getHours()
      ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(
        now.getSeconds()
      ).padStart(2, "0")}`;

      setProcessingMode("upload");

      const result = await uploadImagesToFirebase(folderName);
      if (result && onUploadComplete) {
        onUploadComplete(result);
        setSnackbarMessage("画像のアップロードが完了しました");
        setSnackbarVisible(true);
      }
    }
  };

  // Firebase Storageにアップロードしてからレシピ処理もする
  const handleUploadAndProcess = async () => {
    if (images.length > 0) {
      // フォルダ名を生成（例：recipe_年月日_時分秒）
      const now = new Date();
      const folderName = `recipe_images/${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(
        now.getHours()
      ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(
        now.getSeconds()
      ).padStart(2, "0")}`;

      setProcessingMode("process");

      // アップロードとレシピ処理を実行
      const result = await uploadAndProcessRecipeImage(folderName);

      // 通常のアップロードコールバックも呼び出す（互換性のため）
      if (onUploadComplete && images[0].downloadUrl) {
        onUploadComplete({
          folder: folderName,
          urls: images
            .filter((img) => img.downloadUrl)
            .map((img) => img.downloadUrl!),
        });
      }

      // レシピ処理結果をコールバックで通知
      if (result && onRecipeProcessed) {
        onRecipeProcessed(result);
        prevRecipeResultRef.current = result;
        setSnackbarMessage("レシピの解析が完了しました");
        setSnackbarVisible(true);
      } else if (!result && error) {
        setSnackbarMessage(`エラーが発生しました: ${error}`);
        setSnackbarVisible(true);
      }
    }
  };

  // 画像リストをレンダリング
  const renderImageItem = ({ item }: { item: UploadImage }) => (
    <Card style={styles.imageItem}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.uri }} style={styles.image} />

        {/* ステータスに応じて表示を変更 */}
        {item.status === "uploading" && (
          <View style={styles.uploadingOverlay}>
            <Text style={styles.uploadingText}>アップロード中...</Text>
            <ProgressBar
              progress={item.progress ? item.progress / 100 : 0}
              color="#4CAF50"
            />
          </View>
        )}

        {/* 完了した場合はチェックマークを表示 */}
        {item.status === "complete" && (
          <View style={styles.completeOverlay}>
            <IconButton icon="check-circle" size={30} iconColor="#4CAF50" />
          </View>
        )}
      </View>

      <Card.Actions>
        {/* アップロード中以外は編集と削除を可能に */}
        {item.status !== "uploading" && (
          <>
            <IconButton
              icon="crop"
              onPress={() => handleCropSelectedImage(item.uri)}
            />
            <IconButton icon="delete" onPress={() => removeImage(item.id)} />
          </>
        )}
      </Card.Actions>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* エラーメッセージ */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {images.length === 0 && (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>
            レシピの画像を追加してください。
            複数枚の画像をアップロードして1つのレシピとして処理することができます。
            下のボタンから写真を撮影するか、ギャラリーから選択できます。
          </Text>

          <View style={styles.actionButtonsContainer}>
            <Button
              mode="outlined"
              icon="camera"
              onPress={handleTakePicture}
              style={styles.actionButton}
            >
              写真を撮影
            </Button>

            <Button
              mode="outlined"
              icon="image-multiple"
              onPress={handlePickImage}
              style={styles.actionButton}
            >
              ギャラリーから選択
            </Button>
          </View>
        </View>
      )}

      {/* 選択された画像のリスト */}
      {images.length > 0 && (
        <View style={styles.imagesContainer}>
          <View style={styles.imagesHeader}>
            <Text style={styles.imagesTitle}>
              選択された画像 ({images.length})
            </Text>
            <Button mode="text" onPress={clearImages}>
              すべて削除
            </Button>
          </View>

          <FlatList
            data={images}
            renderItem={renderImageItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={[styles.imagesList, { gap: 16 }]}
            columnWrapperStyle={{ gap: 16 }}
          />
          <View style={styles.buttonContainer}>
            {/* メディア追加ボタン */}
            <View style={styles.mediaButtonsContainer}>
              <Button
                mode="outlined"
                icon="camera"
                onPress={handleTakePicture}
                style={styles.mediaButton}
              >
                写真を追加
              </Button>
              <Button
                mode="outlined"
                icon="image-multiple"
                onPress={handlePickImage}
                style={styles.mediaButton}
              >
                画像を追加
              </Button>
            </View>

            {/* アップロードボタン */}
            <Button
              mode="outlined"
              onPress={handleUpload}
              disabled={isUploading || isProcessing || images.length === 0}
              loading={isUploading && processingMode === "upload"}
              style={[styles.uploadButton, styles.outlineButton]}
            >
              画像をアップロードのみ
            </Button>

            {/* レシピ処理ボタン */}
            <Button
              mode="contained"
              onPress={handleUploadAndProcess}
              disabled={isUploading || isProcessing || images.length === 0}
              loading={
                isProcessing || (isUploading && processingMode === "process")
              }
              style={styles.uploadButton}
            >
              {isProcessing
                ? "レシピを解析中..."
                : isUploading && processingMode === "process"
                ? "アップロード中..."
                : "アップロード＆レシピ解析"}
            </Button>
          </View>

          {/* レシピ処理中の表示 */}
          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.processingText}>
                レシピを解析しています...
                この処理には数十秒かかることがあります。
              </Text>
            </View>
          )}

          {/* レシピ処理結果のプレビュー */}
          {recipeResult && !isProcessing && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>レシピ解析結果:</Text>
              <Text style={styles.resultText}>
                タイトル: {recipeResult.recipeInfo.title}
              </Text>
              {recipeResult.recipeInfo.description && (
                <Text style={styles.resultText} numberOfLines={2}>
                  説明: {recipeResult.recipeInfo.description}
                </Text>
              )}
              <Text style={styles.resultText}>
                調理時間: {recipeResult.recipeInfo.cookTime}分 / 難易度:{" "}
                {recipeResult.recipeInfo.difficulty}
              </Text>
              {/* {recipeResult.additionalImagesCount > 0 && (
                <Text style={styles.resultText}>
                  {recipeResult.recipeInfo.images &&
                  recipeResult.recipeInfo.images.length > 1
                    ? `追加画像: ${recipeResult.recipeInfo.images.length - 1}枚`
                    : ""}
                </Text>
              )} */}
            </View>
          )}
        </View>
      )}

      {/* スナックバー通知 */}
      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
        >
          {snackbarMessage}
        </Snackbar>
      </Portal>
    </View>
  );
};

const makeStyle = ({ width }: { width: number }) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    errorText: {
      color: "#F44336",
      margin: 16,
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyStateText: {
      fontSize: 16,
      textAlign: "center",
      marginBottom: 20,
    },
    actionButtonsContainer: {
      flexDirection: "row",
      justifyContent: "center",
      width: "100%",
    },
    actionButton: {
      margin: 8,
      minWidth: 150,
    },
    imagesContainer: {
      flex: 1,
      marginVertical: 16,
    },
    imagesHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    imagesTitle: {
      fontSize: 16,
      fontWeight: "bold",
    },
    imagesList: {
      paddingHorizontal: 16,
    },
    imageItem: {
      width: width / 2 - 8 * 3,
    },
    imageContainer: {
      position: "relative",
      height: 150,
    },
    image: {
      width: "100%",
      height: "100%",
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    uploadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    uploadingText: {
      color: "white",
      marginBottom: 8,
    },
    completeOverlay: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "white",
      borderRadius: 20,
    },
    buttonContainer: {
      margin: 16,
    },
    mediaButtonsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    mediaButton: {
      flex: 1,
      marginHorizontal: 4,
    },
    uploadButton: {
      marginBottom: 8,
    },
    outlineButton: {
      marginBottom: 16,
    },
    processingContainer: {
      padding: 16,
      alignItems: "center",
      marginHorizontal: 16,
      borderRadius: 8,
    },
    processingText: {
      marginTop: 16,
      textAlign: "center",
    },
    resultContainer: {
      padding: 16,
      marginHorizontal: 16,
      borderRadius: 8,
    },
    resultTitle: {
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 8,
    },
    resultText: {
      marginBottom: 4,
    },
  });
