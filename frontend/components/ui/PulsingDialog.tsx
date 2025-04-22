import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";
import { ActivityIndicator, Dialog, Text } from "react-native-paper";
import { Easing } from "react-native-reanimated";

type PulsingDialogProps = {
  visible: boolean;
  title: string;
  message: string | null;
  isLoading?: boolean;
  minOpacity?: number; // 最小透明度 (0-1)
  maxOpacity?: number; // 最大透明度 (0-1)
  pulseDuration?: number; // パルスの周期（ミリ秒）
  style?: ViewStyle;
};

/**
 * パルスするアニメーション付きのダイアログコンポーネント
 */
const PulsingDialog: React.FC<PulsingDialogProps> = ({
  visible,
  title,
  message,
  isLoading = false,
  minOpacity = 0.8,
  maxOpacity = 1.0,
  pulseDuration = 1000,
  style,
}) => {
  // ダイアログの背景透明度をパルスさせるためのアニメーション値
  const dialogOpacity = useRef(new Animated.Value(minOpacity)).current;

  // ダイアログのパルスアニメーション
  useEffect(() => {
    if (visible && message) {
      // 透明度を設定した範囲でパルスさせる
      Animated.loop(
        Animated.sequence([
          Animated.timing(dialogOpacity, {
            toValue: maxOpacity,
            duration: pulseDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dialogOpacity, {
            toValue: minOpacity,
            duration: pulseDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // アニメーションを停止
      dialogOpacity.stopAnimation();
      dialogOpacity.setValue(minOpacity);
    }

    return () => {
      // コンポーネントがアンマウントされた時にアニメーションをクリーンアップ
      dialogOpacity.stopAnimation();
    };
  }, [visible, message, dialogOpacity, minOpacity, maxOpacity, pulseDuration]);

  // ダイアログのスタイルをアニメーション値と合成
  const animatedDialogStyle = {
    ...styles.dialogContainer,
    ...style,
    backgroundColor: dialogOpacity.interpolate({
      inputRange: [minOpacity, maxOpacity],
      outputRange: [
        `rgba(0, 0, 0, ${minOpacity})`,
        `rgba(0, 0, 0, ${maxOpacity})`,
      ],
    }),
  };

  return (
    <Dialog visible={visible} dismissable={false}>
      <Animated.View style={animatedDialogStyle}>
        <Dialog.Title style={styles.dialogTitle}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.dialogText}>{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          {isLoading && (
            <ActivityIndicator
              animating={true}
              color="#fff"
              style={styles.dialogLoader}
            />
          )}
        </Dialog.Actions>
      </Animated.View>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  dialogContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    padding: 20,
    borderRadius: 12,
    minWidth: "80%",
    maxWidth: "90%",
  },
  dialogTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  dialogText: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 32,
  },
  dialogLoader: {
    marginLeft: 8,
  },
});

export default PulsingDialog;
