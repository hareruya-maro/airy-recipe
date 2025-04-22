import { useEffect, useRef } from "react";
import { useTimerStore } from "../store/timerStore";

/**
 * タイマー機能を提供するカスタムフック
 */
export const useTimer = () => {
  const {
    isTimerActive,
    isDialogVisible,
    duration,
    remainingTime,
    timerDescription,
    isManualTimerDialogVisible,
    setDuration,
    setTimerDescription,
    showTimerDialog,
    hideTimerDialog,
    showManualTimerDialogVisible,
    hideManualTimerDialogVisible,
    startTimer,
    pauseTimer,
    resetTimer,
    updateRemainingTime,
    notifyTimeRemaining,
  } = useTimerStore();

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // タイマーの開始・停止を制御
  useEffect(() => {
    if (isTimerActive && remainingTime > 0) {
      // タイマー作動中なら1秒ごとに減らす
      timerRef.current = setInterval(() => {
        const newRemainingTime = remainingTime - 1;
        updateRemainingTime(newRemainingTime);

        // 残り時間の通知
        notifyTimeRemaining(newRemainingTime);

        if (newRemainingTime <= 0) {
          // 0になったらタイマー停止
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    } else if (!isTimerActive && timerRef.current) {
      // タイマーが停止状態になったらインターバルもクリア
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isTimerActive, remainingTime]);

  // 分秒表記に変換するユーティリティ関数
  const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // 音声コマンドからタイマー時間を解析する関数
  const parseTimeFromVoice = (text: string): number | null => {
    // 「○分」「○秒」のパターンを検出
    const minuteRegex = /(\d+)\s*(分|min)/i;
    const secondRegex = /(\d+)\s*(秒|sec)/i;

    let totalSeconds = 0;
    let found = false;

    // 分を抽出
    const minuteMatch = text.match(minuteRegex);
    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1], 10);
      totalSeconds += minutes * 60;
      found = true;
    }

    // 秒を抽出
    const secondMatch = text.match(secondRegex);
    if (secondMatch) {
      const seconds = parseInt(secondMatch[1], 10);
      totalSeconds += seconds;
      found = true;
    }

    return found ? totalSeconds : null;
  };

  // レシピ手順から調理時間を抽出する関数
  const extractCookingTimeFromStep = (stepText: string): number | null => {
    // 「○分」「○秒」のパターンを検出
    const minuteRegex = /(\d+)\s*(分|min)/i;
    const secondRegex = /(\d+)\s*(秒|sec)/i;

    let totalSeconds = 0;
    let found = false;

    // 分を抽出
    const minuteMatch = stepText.match(minuteRegex);
    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1], 10);
      totalSeconds += minutes * 60;
      found = true;
    }

    // 秒を抽出
    const secondMatch = stepText.match(secondRegex);
    if (secondMatch) {
      const seconds = parseInt(secondMatch[1], 10);
      totalSeconds += seconds;
      found = true;
    }

    return found ? totalSeconds : null;
  };

  // 音声認識テキストからタイマーコマンドを処理する関数
  const processVoiceCommand = (text: string, currentStep?: string): boolean => {
    const lowerText = text.toLowerCase();

    // タイマーキーワードの確認
    const hasTimerKeyword = /タイマー|timer|タイム/i.test(lowerText);

    if (!hasTimerKeyword) return false;

    // 時間が直接指定されている場合
    const seconds = parseTimeFromVoice(lowerText);
    if (seconds) {
      showTimerDialog(seconds);
      return true;
    }

    // 「タイマー開始」などの単純なコマンドで、現在のステップから時間を抽出
    if (currentStep) {
      const stepSeconds = extractCookingTimeFromStep(currentStep);
      if (stepSeconds) {
        showTimerDialog(stepSeconds, `${currentStep}のタイマー`);
        return true;
      }
    }

    return false;
  };

  // タイマーダイアログの操作に対する応答を処理
  const processTimerDialogResponse = (text: string): boolean => {
    if (!isDialogVisible) return false;

    const lowerText = text.toLowerCase();

    // 肯定的な応答パターン
    const confirmPatterns = [/ok|okay|はい|よし|開始|スタート|start/i];

    // 否定的な応答パターン
    const cancelPatterns = [/cancel|キャンセル|やめ|いいえ|ダメ|no/i];

    // 肯定的な応答があった場合、タイマーを開始
    if (confirmPatterns.some((pattern) => pattern.test(lowerText))) {
      startTimer();
      return true;
    }

    // 否定的な応答があった場合、ダイアログを閉じる
    if (cancelPatterns.some((pattern) => pattern.test(lowerText))) {
      hideTimerDialog();
      return true;
    }

    return false;
  };

  return {
    isTimerActive,
    isDialogVisible,
    duration,
    remainingTime,
    timerDescription,
    isManualTimerDialogVisible,
    formatTime,
    setDuration,
    setTimerDescription,
    showTimerDialog,
    hideTimerDialog,
    showManualTimerDialogVisible,
    hideManualTimerDialogVisible,
    startTimer,
    pauseTimer,
    resetTimer,
    processVoiceCommand,
    processTimerDialogResponse,
    extractCookingTimeFromStep,
  };
};
