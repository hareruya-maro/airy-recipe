import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, IconButton, Surface, Text } from "react-native-paper";
import { useModelStore } from "../store/modelStore";

/**
 * モデル初期化中に表示されるインジケーターコンポーネント
 * アプリケーション全体で前面に表示される
 */
export const ModelInitializingIndicator = () => {
  const {
    isModelInitializing,
    showInitCompleteMessage,
    isModelInitializationFailed,
    modelInitializationErrorMessage,
    hideInitFailureMessage,
    showDownloadModal,
  } = useModelStore();

  // 表示条件のいずれも満たさない場合は何も表示しない
  if (
    !isModelInitializing &&
    !showInitCompleteMessage &&
    !isModelInitializationFailed
  ) {
    return null;
  }

  // エラー時はスタイルを調整
  const surfaceStyle = isModelInitializationFailed
    ? [styles.surface, { paddingVertical: 10, paddingRight: 8 }]
    : styles.surface;

  return (
    <View style={styles.container}>
      <Surface style={surfaceStyle} elevation={5}>
        {isModelInitializing ? (
          // 初期化中の表示
          <>
            <ActivityIndicator
              size="small"
              color="#007AFF"
              style={styles.indicator}
            />
            <Text style={styles.text}>AIモデルを初期化中...</Text>
          </>
        ) : isModelInitializationFailed ? (
          // 初期化失敗メッセージ
          <View style={styles.errorContainer}>
            <IconButton
              icon="close"
              size={16}
              style={styles.closeButton}
              onPress={hideInitFailureMessage}
            />
            <Text style={styles.errorText}>
              AI初期化に失敗しました⚠️{" "}
              {modelInitializationErrorMessage
                ? `(${modelInitializationErrorMessage})`
                : ""}
            </Text>
            <Button
              mode="contained"
              compact
              onPress={() => {
                hideInitFailureMessage();
                showDownloadModal();
              }}
              style={styles.repairButton}
            >
              修復
            </Button>
          </View>
        ) : (
          // 初期化完了メッセージ
          <Text style={styles.successText}>AIの利用準備ができました🎉</Text>
        )}
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    zIndex: 9999, // 最前面に表示
    alignItems: "center",
    justifyContent: "center",
  },
  surface: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  indicator: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  successText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50", // 成功を示す緑色
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F44336", // エラーを示す赤色
    flex: 1,
    marginHorizontal: 5,
    flexShrink: 1,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  closeButton: {
    margin: 0,
    padding: 0,
    width: 24,
    height: 24,
  },
  repairButton: {
    marginLeft: 8,
    height: 30,
    justifyContent: "center",
    backgroundColor: "#007AFF",
  },
});
