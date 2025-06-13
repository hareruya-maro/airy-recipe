import ExpoLlmMediapipe from "expo-llm-mediapipe";
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
  const processVoiceCommand = async (
    text: string,
    currentStep?: string,
    modelHandle?: number | null
  ): Promise<boolean> => {
    // Gemma 3モデルが利用可能な場合はそれを使ってタイマーコマンドかどうかを判断する
    if (modelHandle) {
      try {
        // Gemma 3モデルに判断させるためのプロンプト（柔軟な認識を追加）
        const prompt = `
Analyze the user's statement and determine if it's a command related to timer settings.
If it is a command, identify which action should be taken from the following categories:

- set_timer_with_value: Set a timer with a specific time (minutes/seconds) mentioned
  Examples: "set timer for 5 minutes", "timer 30 seconds", "5分のタイマー", "3分タイマーをセット", 
            "タイマー3分", "count 2 minutes", "set alarm for 1 minute", "30秒計って"
- set_timer_from_step: Extract cooking time from the current recipe step and set a timer
  Examples: "timer for this step", "set timer", "start timer", "タイマーをセット", 
            "このステップのタイマー", "タイマーお願い", "時間を計って", "時間を測って"
- not_timer_command: Not a timer-related command

Look for the intent behind the statement, not just exact matches. Understand similar commands even if the phrasing is different.

User's statement: "${text}"
${currentStep ? `Current recipe step: "${currentStep}"` : ""}

Reply with ONLY the category name from above. For example: "set_timer_with_value", "set_timer_from_step", etc.
`;

        console.log("タイマーコマンド判定のプロンプト:", prompt);

        // Gemma 3モデルで判定
        const response = await ExpoLlmMediapipe.generateResponse(
          modelHandle,
          1,
          prompt
        );
        console.log("Gemma 3モデルの判定結果:", response);

        // レスポンスから余分な空白や改行を削除して小文字に統一
        const command = response.trim().toLowerCase();

        if (command.includes("set_timer_with_value")) {
          // 時間が直接指定されている場合
          const seconds = parseTimeFromVoice(text);
          if (seconds) {
            showTimerDialog(seconds);
            return true;
          }
        } else if (command.includes("set_timer_from_step") && currentStep) {
          // 現在のステップから時間を抽出してタイマーをセット
          const stepSeconds = extractCookingTimeFromStep(currentStep);
          if (stepSeconds) {
            showTimerDialog(stepSeconds, `${currentStep}のタイマー`);
            return true;
          }
        }
      } catch (error) {
        console.error("タイマーコマンド判定エラー:", error);
        // エラーが発生した場合はフォールバックとして従来の方法で判定
      }
    }

    // モデルが使えない場合やエラーが発生した場合は従来の方法でタイマーコマンドを判定
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
  const processTimerDialogResponse = async (
    text: string,
    modelHandle?: number | null
  ): Promise<boolean> => {
    if (!isDialogVisible) return false;

    // Gemma 3モデルが利用可能な場合はそれを使ってタイマー確認応答かどうかを判断する
    if (modelHandle) {
      try {
        // Gemma 3モデルに判断させるためのプロンプト（柔軟な認識を追加）
        const prompt = `
Analyze the user's statement and determine if it's a response to the timer confirmation dialog.
A timer confirmation dialog is currently displayed, asking if the user wants to set the timer.
Based on the user's response, identify which action should be taken from the following categories:

- confirm: Start the timer (positive response)
  Examples: "yes", "ok", "sure", "start", "confirm", "go ahead", "proceed", "はい", "オッケー", 
            "いいよ", "開始", "スタート", "始めて", "セットして", "タイマースタート", "うん"
- cancel: Cancel the timer (negative response)
  Examples: "no", "cancel", "don't", "stop", "nevermind", "いいえ", "キャンセル", "やめて", 
            "必要ない", "不要", "ダメ", "止めて", "ストップ", "結構です"
- not_response: Not a valid response

Look for the intent behind the statement, not just exact matches. Understand similar responses even if the phrasing is different.

User's statement: "${text}"

Reply with ONLY the category name from above. For example: "confirm", "cancel", etc.
`;

        console.log("タイマー確認応答判定のプロンプト:", prompt);

        // Gemma 3モデルで判定
        const response = await ExpoLlmMediapipe.generateResponse(
          modelHandle,
          1,
          prompt
        );
        console.log("Gemma 3モデルの判定結果:", response);

        // レスポンスから余分な空白や改行を削除して小文字に統一
        const command = response.trim().toLowerCase();

        if (command.includes("confirm")) {
          startTimer();
          return true;
        } else if (command.includes("cancel")) {
          hideTimerDialog();
          return true;
        }
      } catch (error) {
        console.error("タイマー確認応答判定エラー:", error);
        // エラーが発生した場合はフォールバックとして従来の方法で判定
      }
    }

    // モデルが使えない場合やエラーが発生した場合は従来の方法でタイマー応答を判定
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
