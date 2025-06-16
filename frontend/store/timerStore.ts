import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { LayoutAnimation } from "react-native";
import { create } from "zustand";

interface TimerState {
  isTimerActive: boolean;
  isDialogVisible: boolean;
  duration: number; // 秒単位
  remainingTime: number; // 秒単位
  timerDescription?: string;
  isManualTimerDialogVisible: boolean;

  // アクション
  setDuration: (seconds: number) => void;
  setTimerDescription: (description: string | undefined) => void;
  showTimerDialog: (seconds: number, description?: string) => void;
  hideTimerDialog: () => void;
  showManualTimerDialogVisible: () => void;
  hideManualTimerDialogVisible: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  updateRemainingTime: (seconds: number) => void;
  notifyTimeRemaining: (seconds: number) => Promise<void>;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  isTimerActive: false,
  isDialogVisible: false,
  duration: 0,
  remainingTime: 0,
  timerDescription: undefined,
  isManualTimerDialogVisible: false,

  setDuration: (seconds) => set({ duration: seconds, remainingTime: seconds }),

  setTimerDescription: (description) => set({ timerDescription: description }),

  showTimerDialog: (seconds, description) =>
    set({
      duration: seconds,
      remainingTime: seconds,
      isDialogVisible: true,
      timerDescription: description,
    }),

  hideTimerDialog: () => set({ isDialogVisible: false }),

  showManualTimerDialogVisible: () =>
    set({
      isManualTimerDialogVisible: true,
    }),

  hideManualTimerDialogVisible: () =>
    set({
      isManualTimerDialogVisible: false,
    }),

  startTimer: () =>
    set({
      isTimerActive: true,
      isDialogVisible: false,
    }),

  pauseTimer: () => set({ isTimerActive: false }),

  resetTimer: () => {
    console.log("タイマーをリセットします");
    const { duration } = get();
    set({
      remainingTime: duration,
      isTimerActive: false,
    });
  },

  updateRemainingTime: (seconds) => set({ remainingTime: seconds }),

  notifyTimeRemaining: async (seconds) => {
    // 通知が必要なタイミングかチェック
    const notificationTimes = [300, 60, 30, 0]; // 5分、1分、30秒、0秒
    if (notificationTimes.includes(seconds)) {
      let message = "";

      if (seconds === 300) message = "残り5分です";
      else if (seconds === 60) message = "残り1分です";
      else if (seconds === 30) message = "残り30秒です";
      else if (seconds === 0) message = "タイマーが終了しました";

      if (message) {
        // 終了時のみ音を鳴らす
        if (seconds === 0) {
          console.log("タイマー終了音を再生します");
          try {
            // オーディオモードを設定
            await Audio.setAudioModeAsync({
              playsInSilentModeIOS: true, // サイレントモードでも再生
              staysActiveInBackground: true, // バックグラウンドでも再生を続行
              shouldDuckAndroid: true, // 他の音声を一時的に小さくする
            });

            // サウンドロード
            const soundObject = new Audio.Sound();
            await soundObject.loadAsync(
              require("../assets/sounds/ringtone_loop.wav")
            );

            // 最大音量で再生
            await soundObject.setIsMutedAsync(false);
            await soundObject.setVolumeAsync(1.0);

            // 最初の再生
            await soundObject.playAsync();
            console.log("再生開始しました");

            // タイマーで複数回再生（代替手段として使用）
            let playCount = 1;
            const maxPlays = 5;

            const playInterval = setInterval(async () => {
              if (playCount >= maxPlays) {
                clearInterval(playInterval);
                await soundObject.unloadAsync();
                console.log("サウンド再生完了・解放しました");
                LayoutAnimation.easeInEaseOut();
                set({ isTimerActive: false });
                return;
              }

              playCount++;
              try {
                await soundObject.replayAsync();
                console.log(`${playCount}回目の再生です`);
              } catch (err) {
                console.error("リプレイエラー:", err);
                clearInterval(playInterval);
                try {
                  await soundObject.unloadAsync();
                } catch (e) {}
              }
            }, 2500);
          } catch (error) {
            console.error("音声再生エラー:", error);
          }
        } else {
          // 音声読み上げ
          Speech.speak(message, { language: "ja-JP" });
        }
      }
    }
  },
}));
