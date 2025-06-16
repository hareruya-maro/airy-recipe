import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";
import { useModelStore } from "../store/modelStore";

/**
 * モデル初期化中に表示されるインジケーターコンポーネント
 * アプリケーション全体で前面に表示される
 */
export const ModelInitializingIndicator = () => {
  const { isModelInitializing, showInitCompleteMessage } = useModelStore();

  // 初期化中でも完了メッセージ表示中でもない場合は何も表示しない
  if (!isModelInitializing && !showInitCompleteMessage) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.surface} elevation={5}>
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
});
