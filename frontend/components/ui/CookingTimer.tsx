import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import {
  Button,
  Dialog,
  IconButton,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";
import { useTimer } from "../../hooks/useTimer";

interface CookingTimerProps {
  currentStep?: string;
}

export const CookingTimer: React.FC<CookingTimerProps> = ({ currentStep }) => {
  const {
    isTimerActive,
    isDialogVisible,
    remainingTime,
    timerDescription,
    duration,
    isManualTimerDialogVisible,
    formatTime,
    startTimer,
    pauseTimer,
    resetTimer,
    hideTimerDialog,
    showTimerDialog,
    showManualTimerDialogVisible,
    hideManualTimerDialogVisible,
    setDuration,
  } = useTimer();

  // 手動でタイマーを設定するダイアログの状態
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");

  // アニメーション用のRef
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // パルスアニメーション
  useEffect(() => {
    if (isTimerActive && remainingTime > 0) {
      // 1秒ごとにパルスアニメーション
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // タイマーが終了または非アクティブの場合、アニメーションをリセット
      pulseAnim.setValue(1);
    }
  }, [isTimerActive, remainingTime]);

  // タイマーが0になったときの視覚効果
  const getTimerColor = () => {
    if (remainingTime <= 0 && isTimerActive) {
      return "#ff4d4d";
    }
    if (remainingTime <= 60) {
      return "#ff9933";
    }
    return "#3498db";
  };

  // 手動タイマー設定のダイアログを開く
  const openManualTimerDialog = () => {
    setMinutes("");
    setSeconds("");
    showManualTimerDialogVisible();
  };

  // タイマーを設定して開始する
  const handleSetTimer = () => {
    const mins = parseInt(minutes) || 0;
    const secs = parseInt(seconds) || 0;
    const totalSeconds = mins * 60 + secs;

    if (totalSeconds > 0) {
      hideManualTimerDialogVisible();
      showTimerDialog(totalSeconds);
    }
  };

  // タイマーコンポーネントのレンダリング
  return (
    <>
      {/* タイマー表示 */}
      {(isTimerActive || remainingTime > 0) && (
        <Animated.View
          style={[
            styles.timerContainer,
            {
              backgroundColor: getTimerColor(),
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={styles.timerContentContainer}>
            <View style={styles.timerTextContainer}>
              <Text style={styles.timerText}>{formatTime(remainingTime)}</Text>
              {timerDescription && (
                <Text style={styles.descriptionText}>{timerDescription}</Text>
              )}
            </View>

            <View style={styles.timerControls}>
              {isTimerActive ? (
                <IconButton
                  icon="pause"
                  size={20}
                  iconColor="#fff"
                  onPress={pauseTimer}
                />
              ) : (
                <IconButton
                  icon="play"
                  size={20}
                  iconColor="#fff"
                  onPress={startTimer}
                />
              )}
              <IconButton
                icon="restart"
                size={20}
                iconColor="#fff"
                onPress={resetTimer}
              />
            </View>
          </View>
        </Animated.View>
      )}

      {/* タイマー設定確認ダイアログ */}
      <Portal>
        <Dialog visible={isDialogVisible} onDismiss={hideTimerDialog}>
          <Dialog.Title>タイマーを開始しますか？</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {timerDescription ? `${timerDescription}` : ""}
              {duration > 0 && ` - ${formatTime(duration)}のタイマー`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideTimerDialog}>キャンセル</Button>
            <Button onPress={startTimer}>開始</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 手動タイマー設定ダイアログ */}
      <Portal>
        <Dialog
          visible={isManualTimerDialogVisible}
          onDismiss={() => hideManualTimerDialogVisible()}
        >
          <Dialog.Title>タイマー設定</Dialog.Title>
          <Dialog.Content>
            <View style={styles.timerInputContainer}>
              <TextInput
                label="分"
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                style={styles.timerInput}
              />
              <Text variant="bodyLarge" style={styles.timerInputSeparator}>
                :
              </Text>
              <TextInput
                label="秒"
                value={seconds}
                onChangeText={setSeconds}
                keyboardType="number-pad"
                style={styles.timerInput}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => hideManualTimerDialogVisible()}>
              キャンセル
            </Button>
            <Button onPress={handleSetTimer}>設定</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  timerContainer: {
    padding: 10,
    borderRadius: 16,
    marginVertical: 8,
    backgroundColor: "#3498db",
    alignItems: "center",
    marginHorizontal: 5,
  },
  timerContentContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  timerTextContainer: {
    flex: 1,
    alignItems: "flex-start",
  },
  timerText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
  },
  descriptionText: {
    fontSize: 14,
    color: "#fff",
    marginTop: 4,
  },
  timerControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  timerButtonContainer: {
    marginVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
  },
  timerButton: {
    borderRadius: 16,
  },
  timerInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  timerInput: {
    flex: 1,
  },
  timerInputSeparator: {
    marginHorizontal: 10,
    fontSize: 24,
    fontWeight: "bold",
  },
});
