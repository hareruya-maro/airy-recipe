import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  MD3Theme,
  Modal,
  Portal,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { MODEL_NAME, useModelStore } from "../store/modelStore";

export const ModelDownloadModal = () => {
  const styles = makeStyle(useTheme());
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
    isModelDownloaded,
    createModel,
    isModelInitializing, // モデル初期化状態を取得
    isModelInitializationFailed, // モデル初期化失敗状態を取得
    isDeletingModel, // モデル削除中状態を取得
    deleteModel, // モデル削除関数
  } = useModelStore();

  // コンポーネントがマウントされたらダウンロードリスナーをセットアップ
  useEffect(() => {
    const listener = setupModelDownloadListener();

    // コンポーネントがアンマウントされたらリスナーを削除
    return () => {
      removeModelDownloadListener(listener);
    };
  }, [setupModelDownloadListener, removeModelDownloadListener]);

  // モデルダウンロード完了時にモデルを初期化する
  useEffect(() => {
    const initializeModel = async () => {
      if (isModelDownloaded && !isModelDownloading) {
        try {
          console.log(
            "モデルが正常にダウンロードされました。初期化を開始します。"
          );
          await createModel();
        } catch (error) {
          console.error("モデル初期化エラー:", error);
        }
      }
    };

    initializeModel();
  }, [isModelDownloaded, isModelDownloading, createModel]);

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
            <Text style={styles.modelSize}>サイズ: 約3GB</Text>
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
        ) : isDeletingModel ? (
          <>
            <ProgressBar indeterminate style={styles.progressBar} />
            <Text style={styles.progressText}>モデルを削除中...</Text>
          </>
        ) : isModelInitializing ? (
          <>
            <ProgressBar indeterminate style={styles.progressBar} />
            <Text style={styles.progressText}>AIモデルを初期化中...</Text>
          </>
        ) : isModelInitializationFailed ? (
          <>
            <Text style={styles.errorText}>
              AIモデルの初期化に失敗しました。モデルが正しくダウンロードされていない可能性があります。
            </Text>
            <View style={styles.buttonGroup}>
              <Button
                mode="contained"
                onPress={deleteModel}
                style={[styles.actionButton, styles.deleteButton]}
                icon="delete"
              >
                削除
              </Button>
              <Button
                mode="contained"
                onPress={downloadModel}
                style={[styles.actionButton, styles.downloadButton]}
                icon="refresh"
                disabled={isModelDownloaded}
              >
                再ダウンロード
              </Button>
            </View>
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

const makeStyle = (theme: MD3Theme) =>
  StyleSheet.create({
    containerStyle: {
      backgroundColor: theme.colors.surface,
      padding: 20,
      margin: 20,
      borderRadius: 10,
      maxWidth: 400,
      alignSelf: "center", // 中央揃えにする
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
      backgroundColor: theme.colors.secondaryContainer,
      padding: 10,
      borderRadius: 5,
    },
    modelName: {
      fontWeight: "bold",
    },
    modelSize: {
      marginTop: 4,
      color: theme.colors.onSecondaryContainer,
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
    errorText: {
      marginVertical: 16,
      color: "#D32F2F",
      textAlign: "center",
      fontWeight: "500",
    },
    buttonGroup: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 5,
    },
    deleteButton: {
      backgroundColor: "#D32F2F",
    },
  });
