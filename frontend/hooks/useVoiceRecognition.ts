import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from "@react-native-voice/voice";
import { httpsCallable } from "firebase/functions";
import { useEffect, useRef, useState } from "react";
import { functions } from "../config/firebase";
import { useRecipeStore } from "../store/recipeStore";

// コールバック関数の型定義
type VoiceCallbacks = {
  onShowIngredients?: (isShow: boolean) => void; // 材料表示用コールバック
};

export const useVoiceRecognition = (callbacks?: VoiceCallbacks) => {
  const {
    isVoiceListening,
    setVoiceListening,
    setRecognizedText,
    setLastAIResponse,
    nextStep,
    previousStep,
    currentRecipe,
    currentStepIndex, // storeから現在のステップインデックスを取得
  } = useRecipeStore();

  const [error, setError] = useState<string>("");
  const [isProcessingLLM, setIsProcessingLLM] = useState<boolean>(false);
  // 現在の認識テキストを保持するRef
  const currentTextRef = useRef<string>("");
  // debounceタイマーID
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 音声認識中かどうか
  const isProcessingRef = useRef<boolean>(false);
  // debounce時間（ミリ秒）
  const DEBOUNCE_TIME_MS = 800;

  // Firebase Functionsのプロセス関数
  const processVoiceCommandFunction = httpsCallable(
    functions,
    "processVoiceCommand"
  );

  // コマンドの処理を行う関数（debounce処理付き）
  const processWithDebounce = (text: string) => {
    console.log("Debounce処理開始:", text);
    // すでにタイマーがセットされていれば解除
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 新たにタイマーをセット
    debounceTimerRef.current = setTimeout(() => {
      console.log("Debounce完了、コマンド処理:", text);
      processVoiceCommand(text);
      debounceTimerRef.current = null;
    }, DEBOUNCE_TIME_MS);
  };

  useEffect(() => {
    // 音声認識イベントリスナーの設定
    Voice.onSpeechStart = () => {
      console.log("音声認識開始");
      isProcessingRef.current = true;
      setVoiceListening(true);
      // 認識開始時にテキストをリセット
      currentTextRef.current = "";
      setRecognizedText("");
    };

    Voice.onSpeechEnd = () => {
      console.log("音声認識終了");
      setVoiceListening(false);

      // 音声認識が終了した時点で最終的なテキストでコマンドを処理
      if (isProcessingRef.current && currentTextRef.current) {
        console.log("音声認識終了時のテキスト:", currentTextRef.current);
        // 直接処理せずdebounce処理を行う
        processWithDebounce(currentTextRef.current);
        isProcessingRef.current = false;
      }
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (e.value && e.value.length > 0) {
        const recognizedText = e.value[0];
        console.log("認識テキスト更新:", recognizedText);

        // UIに認識テキストを表示
        setRecognizedText(recognizedText);

        // 現在の認識テキストを更新
        currentTextRef.current = recognizedText;
        processWithDebounce(currentTextRef.current);
      }
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      console.log("音声認識エラー:", e.error);
      setError(e.error?.message || "Unknown error");
      setVoiceListening(false);
      isProcessingRef.current = false;

      // エラーが発生した場合、それまでに認識されたテキストで処理
      if (currentTextRef.current) {
        processWithDebounce(currentTextRef.current);
      }
    };

    // クリーンアップ関数
    return () => {
      // タイマーがあればクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      Voice.destroy().then(() => {
        setVoiceListening(false);
      });
      Voice.removeAllListeners();
    };
  }, [currentRecipe]);

  // 音声認識の開始
  const startVoiceRecognition = async () => {
    try {
      setError("");
      // テキストリセット
      currentTextRef.current = "";
      setRecognizedText("");

      // 実行中のタイマーがあればクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      await Voice.start("ja-JP"); // 日本語で音声認識
      setVoiceListening(true);
    } catch (e) {
      console.error(e);
      setError("音声認識の起動に失敗しました");
    }
  };

  // 音声認識の停止
  const stopVoiceRecognition = async () => {
    try {
      await Voice.stop();
      setVoiceListening(false);
    } catch (e) {
      console.error(e);
      setError("音声認識の停止に失敗しました");
    }
  };

  const restartVoiceRecognition = async () => {
    try {
      await Voice.destroy();
      await Voice.start("ja-JP");
      setVoiceListening(true);
    } catch (e) {
      console.error(e);
      setError("音声認識の再起動に失敗しました");
    }
  };

  // Firebase FunctionsでLLMを使ってコマンド処理を行う関数
  const processWithLLM = async (text: string) => {
    try {
      setIsProcessingLLM(true);

      console.log("processWithLLM", text);

      // 現在のレシピコンテキストを準備
      const recipeContext = currentRecipe
        ? {
            title: currentRecipe.title,
            currentStep: currentRecipe.steps[currentStepIndex], // storeから取得したcurrentStepIndexを使用
            stepNumber: currentStepIndex + 1, // storeから取得したcurrentStepIndexを使用
            totalSteps: currentRecipe.steps.length,
            ingredients: currentRecipe.ingredients,
          }
        : null;

      console.log("LLM処理開始:", { text, recipeContext });
      console.log(processVoiceCommandFunction);

      // Firebase Functions呼び出し
      const result = await processVoiceCommandFunction({
        text,
        recipeContext,
      });

      console.log("LLM処理結果:", result);

      // レスポンスの型定義
      interface LLMResponse {
        success: boolean;
        response?: string;
        error?: string;
      }

      // データにアクセス
      const data = result.data as LLMResponse;

      if (data.success && data.response) {
        console.log("LLM応答:", data.response);
        setLastAIResponse(data.response);
      } else {
        console.error("LLMエラー:", data.error);
        setLastAIResponse(
          "申し訳ありません、応答の処理中にエラーが発生しました"
        );
      }
    } catch (e: any) {
      console.error("LLM処理エラー:", e, e.message, (e as Error).name);
      setLastAIResponse("申し訳ありません、処理中にエラーが発生しました");
    } finally {
      setIsProcessingLLM(false);
    }
  };

  // コマンド処理のメイン関数
  const processVoiceCommand = (text: string) => {
    if (!text.trim()) return; // 空のテキストは処理しない

    // すべて小文字で比較して、部分一致でコマンドを処理
    const lowerText = text.toLowerCase();
    console.log("コマンド処理実行:", lowerText);

    // 基本コマンドを先に処理（即時応答が必要なもの）
    if (
      lowerText.includes("次") ||
      lowerText.includes("次へ") ||
      lowerText.includes("進める")
    ) {
      nextStep();
      setLastAIResponse("次のステップに進みます");
      restartVoiceRecognition();
      return;
    } else if (
      lowerText.includes("戻る") ||
      lowerText.includes("前") ||
      lowerText.includes("前へ") ||
      lowerText.includes("戻って")
    ) {
      previousStep();
      setLastAIResponse("前のステップに戻ります");
      restartVoiceRecognition();
      return;
    } else if (
      lowerText.includes("材料") ||
      lowerText.includes("ざいりょう") ||
      lowerText.includes("ingredient")
    ) {
      // 材料リストを表示するための状態更新
      setLastAIResponse("材料リストを表示します");
      // コールバック関数が提供されている場合は実行
      if (callbacks?.onShowIngredients) {
        callbacks.onShowIngredients(true);
      }
      restartVoiceRecognition();
      return;
    } else if (
      lowerText.includes("手順") ||
      lowerText.includes("てじゅん") ||
      lowerText.includes("ステップ") ||
      lowerText.includes("step")
    ) {
      // 手順リストを表示するための状態更新
      setLastAIResponse("手順リストを表示します");
      // 材料表示を無効にする（コールバックが提供されている場合）
      if (callbacks?.onShowIngredients) {
        callbacks.onShowIngredients(false); // 材料を非表示（手順を表示）
      }
      restartVoiceRecognition();
      return;
    }

    // 基本コマンドに該当しない場合はLLMで処理
    processWithLLM(text);

    // LLM処理後に音声認識を再開
    restartVoiceRecognition();
  };

  return {
    isListening: isVoiceListening,
    isProcessingLLM,
    error,
    startVoiceRecognition,
    stopVoiceRecognition,
    restartVoiceRecognition,
  };
};
