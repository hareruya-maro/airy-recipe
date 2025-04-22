import { Audio } from "expo-av";
import * as Speech from "expo-speech";
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
        // 音声読み上げ
        await Speech.speak(message, { language: "ja-JP" });

        // 終了時のみ音を鳴らす（5回繰り返し）
        if (seconds === 0) {
          const { sound } = await Audio.Sound.createAsync(
            require("../assets/sounds/ringtone_loop.wav")
          );

          // 5回再生を設定
          let playCount = 0;
          const playSound = async () => {
            if (playCount < 5) {
              await sound.playAsync();

              // 再生終了イベントにリスナーを設定
              sound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.isLoaded) {
                  playCount++;
                  if (playCount < 5) {
                    // 再度再生
                    await sound.replayAsync();
                  } else {
                    // 5回再生完了後に解放
                    await sound.unloadAsync();
                  }
                }
              });
            }
          };

          // 最初の再生を開始
          await playSound();
        }
      }
    }
  },
}));
