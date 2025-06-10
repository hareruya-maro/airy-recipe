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

  return (
    <Dialog visible={visible} dismissable={false}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Content>
        <Text variant="titleLarge">{message}</Text>
      </Dialog.Content>
      <Dialog.Actions>
        {isLoading && (
          <ActivityIndicator animating={true} style={styles.dialogLoader} />
        )}
      </Dialog.Actions>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  dialogLoader: {
    marginLeft: 8,
  },
});

export default PulsingDialog;
