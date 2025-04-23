import { useState } from "react";
import { FlatList, Image, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  FAB,
  IconButton,
  Menu,
  Portal,
  ProgressBar,
  Text,
} from "react-native-paper";
import { UploadImage, useImageUpload } from "../../hooks/useImageUpload";

type RecipeImageUploaderProps = {
  onUploadComplete?: (result: { folder: string; urls: string[] }) => void;
};

export const RecipeImageUploader = ({
  onUploadComplete,
}: RecipeImageUploaderProps) => {
  const [menuVisible, setMenuVisible] = useState(false);

  const {
    images,
    isUploading,
    error,
    takePicture,
    pickImage,
    cropImage,
    uploadImagesToFirebase,
    clearImages,
    removeImage,
  } = useImageUpload();

  // メニューを開く・閉じる
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  // 写真を撮影
  const handleTakePicture = async () => {
    closeMenu();
    await takePicture();
  };

  // ギャラリーから選択
  const handlePickImage = async () => {
    closeMenu();
    await pickImage();
  };

  // 選択された画像をトリミング
  const handleCropSelectedImage = (imageUri: string) => {
    cropImage(imageUri);
  };

  // Firebase Storageにアップロードする
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

      const result = await uploadImagesToFirebase(folderName);
      if (result && onUploadComplete) {
        onUploadComplete(result);
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
    <View style={styles.container}>
      {/* エラーメッセージ */}
      {error && <Text style={styles.errorText}>{error}</Text>}

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
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagesList}
          />

          <Button
            mode="contained"
            onPress={handleUpload}
            disabled={isUploading || images.length === 0}
            loading={isUploading}
            style={styles.uploadButton}
          >
            {isUploading ? "アップロード中..." : "Firebaseにアップロード"}
          </Button>
        </View>
      )}

      {/* FABとメニュー */}
      <Portal>
        <View style={styles.fabContainer}>
          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={<FAB icon="cog" style={styles.fab} onPress={openMenu} />}
          >
            <Menu.Item
              leadingIcon="camera"
              onPress={handleTakePicture}
              title="写真を撮影"
            />
            <Menu.Item
              leadingIcon="image-multiple"
              onPress={handlePickImage}
              title="ギャラリーから選択"
            />
          </Menu>
        </View>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorText: {
    color: "#F44336",
    margin: 16,
  },
  fabContainer: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
  fab: {
    backgroundColor: "#2196F3",
  },
  imagesContainer: {
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
    width: 200,
    marginRight: 16,
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
  uploadButton: {
    margin: 16,
  },
});
