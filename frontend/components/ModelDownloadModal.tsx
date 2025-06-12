import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Modal, Portal, ProgressBar, Text } from "react-native-paper";
import { MODEL_NAME, useModelStore } from "../store/modelStore";

export const ModelDownloadModal = () => {
  const {
    isModelDownloadModalVisible,
    isModelDownloading,
    downloadProgress,
    lastMessage,
    downloadModel,
    cancelDownload,
    hideDownloadModal,
    setupModelDownloadListener,
    removeModelDownloadListener,
  } = useModelStore();

  // コンポーネントがマウントされたらダウンロードリスナーをセットアップ
  useEffect(() => {
    const listener = setupModelDownloadListener();

    // コンポーネントがアンマウントされたらリスナーを削除
    return () => {
      removeModelDownloadListener(listener);
    };
  }, [setupModelDownloadListener, removeModelDownloadListener]);

  return (
    <Portal>
      <Modal
        visible={isModelDownloadModalVisible}
        dismissable={!isModelDownloading} // ダウンロード中は閉じれないようにする
        onDismiss={hideDownloadModal}
        contentContainerStyle={styles.containerStyle}
      >
        <Text style={styles.title}>AIモデルのダウンロード</Text>

        <Text style={styles.description}>
          AIry
          Recipeのフル機能を使用するには、必要なAIモデルをダウンロードする必要があります。
          Wi-Fi環境での実行をおすすめします。
        </Text>

        <View style={styles.modelInfo}>
          <Text style={styles.modelName}>モデル: {MODEL_NAME}</Text>
          {!isModelDownloading && (
            <Text style={styles.modelSize}>サイズ: 約150MB</Text>
          )}
        </View>

        {isModelDownloading ? (
          <>
            <ProgressBar
              progress={downloadProgress}
              style={styles.progressBar}
            />
            <Text style={styles.progressText}>
              {Math.round(downloadProgress * 100)}% 完了
            </Text>
            <Button
              mode="contained"
              onPress={cancelDownload}
              style={styles.cancelButton}
            >
              キャンセル
            </Button>
          </>
        ) : (
          <Button
            mode="contained"
            onPress={downloadModel}
            style={styles.downloadButton}
          >
            ダウンロード開始
          </Button>
        )}

        {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  containerStyle: {
    backgroundColor: "white",
    padding: 20,
    margin: 20,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    marginBottom: 16,
    lineHeight: 20,
  },
  modelInfo: {
    marginBottom: 20,
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 5,
  },
  modelName: {
    fontWeight: "bold",
  },
  modelSize: {
    marginTop: 4,
    color: "#666",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginVertical: 10,
  },
  progressText: {
    textAlign: "center",
    marginBottom: 15,
  },
  downloadButton: {
    marginTop: 10,
  },
  cancelButton: {
    marginTop: 10,
    backgroundColor: "#D32F2F",
  },
  message: {
    marginTop: 16,
    padding: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    textAlign: "center",
  },
});
