import {
  Canvas,
  Rect,
  LinearGradient as SkiaGradient,
  vec,
} from "@shopify/react-native-skia";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import {
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type FlowingGradientProps = {
  initialLeftColor?: string;
  initialRightColor?: string;
};

export type FlowingGradientRef = {
  startColorAnimation: (duration?: number) => void;
  stopColorAnimation: () => void;
  setShowIngredients?: (show?: boolean) => void;
};

/**
 * フロー効果のあるグラデーションバックグラウンド
 */
const FlowingGradient = forwardRef<FlowingGradientRef, FlowingGradientProps>(
  ({ initialLeftColor = "#2c3e50", initialRightColor = "#1a1a2e" }, ref) => {
    const { width, height } = Dimensions.get("window");
    const leftColor = useSharedValue(initialLeftColor);
    const rightColor = useSharedValue(initialRightColor);
    const interval = useRef<NodeJS.Timeout | null>(null);

    const colors = useDerivedValue(() => {
      return [leftColor.value, rightColor.value];
    }, []);

    // ランダムな色を生成
    const getRandomColor = () => {
      const r = Math.floor(Math.random() * 156 + 100);
      const g = Math.floor(Math.random() * 100 + 50);
      const b = Math.floor(Math.random() * 156 + 100);
      return `rgba(${r}, ${g}, ${b}, 1)`;
    };

    // グラデーション色のアニメーション開始
    const startColorAnimation = (duration: number = 2000) => {
      // すでに実行中のインターバルをクリア
      if (interval.current) {
        clearInterval(interval.current);
      }

      // 新しいインターバルを設定
      interval.current = setInterval(() => {
        leftColor.value = withTiming(getRandomColor(), { duration });
        rightColor.value = withTiming(getRandomColor(), { duration });
      }, duration);

      return () => {
        if (interval.current) {
          clearInterval(interval.current);
          interval.current = null;
        }
      };
    };

    // グラデーション色のアニメーション停止
    const stopColorAnimation = () => {
      if (interval.current) {
        clearInterval(interval.current);
        interval.current = null;
      }

      // 元の色に戻る
      leftColor.value = withTiming(initialLeftColor, { duration: 300 });
      rightColor.value = withTiming(initialRightColor, { duration: 300 });
    };

    // コンポーネント外からメソッドを呼び出せるようにする
    useImperativeHandle(ref, () => ({
      startColorAnimation,
      stopColorAnimation,
    }));

    return (
      <View style={styles.flowingGradientWrapper}>
        <Canvas style={{ flex: 1 }}>
          <Rect x={0} y={0} width={width} height={height}>
            <SkiaGradient
              start={vec(0, 0)}
              end={vec(width, height)}
              colors={colors}
            />
          </Rect>
        </Canvas>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  flowingGradientWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: "hidden",
    pointerEvents: "none", // タッチイベントを下層に通す
  },
});

export { FlowingGradient, type FlowingGradientProps };
