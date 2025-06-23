import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from "@react-native-voice/voice";
import ExpoLlmMediapipe from "expo-llm-mediapipe"; // Gemma 3モデルを使うためのライブラリ
import * as Speech from "expo-speech"; // TTSのためのexpo-speechをインポート
import { useCallback, useEffect, useRef, useState } from "react";
import { functions } from "../config/firebase";
import { useRecipeStore } from "../store/recipeStore";

// コールバック関数の型定義
type VoiceCallbacks = {
  onShowIngredients?: (isShow: boolean) => void; // 材料表示用コールバック
  onVoiceRecognitionResult?: (text: string) => Promise<boolean> | boolean; // 音声認識結果処理用コールバック（返り値はコマンドが処理されたかどうか）
  onManualTextInput?: () => void; // 手動テキスト入力を要求するコールバック
  modelHandle?: number | null; // Gemma 3モデルハンドル（cookingMode.tsxから提供される）
};

export const useVoiceRecognition = (callbacks?: VoiceCallbacks) => {
  // 外部から提供されたmodelHandleを利用（cookingMode.tsxからのモデルハンドル）
  const externalModelHandle = callbacks?.modelHandle;
  const {
    isVoiceListening,
    setVoiceListening,
    setRecognizedText,
    setLastAIResponse,
    nextStep,
    previousStep,
    currentRecipe,
    currentStepIndex,
    addConversationMessage, // 会話履歴に追加する関数
    setDialogVisible, // ダイアログ表示状態を設定する関数
    setVideoModalVisible, // 動画モーダル表示状態を設定する関数
    setCurrentVideoUrl, // 現在の動画URLを設定する関数
  } = useRecipeStore();

  const [error, setError] = useState<string>("");
  const [isProcessingLLM, setIsProcessingLLM] = useState<boolean>(false);
  // 現在の認識テキストを保持するRef
  const currentTextRef = useRef<string>("");
  const pastTextRef = useRef<string>("");
  // TTSが現在話しているかどうか
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  // debounceタイマーID
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 音声認識中かどうか
  const isProcessingRef = useRef<boolean>(false);
  // debounce時間（ミリ秒）
  const DEBOUNCE_TIME_MS = 800;

  // TTSで文章を読み上げる関数
  const speakResponse = async (text: string) => {
    try {
      // 現在話している場合は一旦停止
      if (isSpeaking) {
        await Speech.stop();
      }

      // 先にダイアログを表示状態にする
      console.log("ダイアログを表示します");
      setDialogVisible(true);

      // 日本語で読み上げるようにオプションを設定
      setIsSpeaking(true);
      console.log("音声読み上げを開始します");
      Speech.speak(text, {
        language: "ja-JP",
        // 読み上げ完了時のコールバック
        onDone: () => {
          console.log("音声読み上げが完了しました");
          setIsSpeaking(false);
          // 読み上げ終了後にダイアログを非表示
          setDialogVisible(false);
        },
        // エラー発生時のコールバック
        onError: (error) => {
          console.error("TTSエラー:", error);
          setIsSpeaking(false);
          // エラー時もダイアログを非表示
          setDialogVisible(false);
        },
        onStopped: () => {
          console.log("音声読み上げが停止されました");
          setIsSpeaking(false);
          setDialogVisible(false);
        },
      });
    } catch (e) {
      console.error("TTSエラー:", e);
      setIsSpeaking(false);
      // エラー時もダイアログを非表示
      setDialogVisible(false);
    }
  };

  // 動画表示用の応答読み上げ関数（読み上げ後に動画モーダルを表示）
  const speakResponseWithVideo = async (text: string, videoUrl: string) => {
    try {
      // 現在話している場合は一旦停止
      if (isSpeaking) {
        await Speech.stop();
      }

      // 動画URLを設定
      setCurrentVideoUrl(videoUrl);

      // 先にダイアログを表示状態にする
      console.log("ダイアログを表示します");
      setDialogVisible(true);

      // 少し待ってから読み上げを開始（UIの更新を確実にするため）
      setTimeout(async () => {
        // 日本語で読み上げるようにオプションを設定
        setIsSpeaking(true);
        console.log("音声読み上げを開始します");

        Speech.speak(text, {
          language: "ja-JP",
          // 読み上げ完了時のコールバック
          onDone: () => {
            console.log("音声読み上げが完了しました");
            setIsSpeaking(false);
            // 読み上げ終了後にダイアログを非表示
            setDialogVisible(false);
            // 動画モーダルを表示
            console.log("動画モーダルを表示します");
            setVideoModalVisible(true);
          },
          // エラー発生時のコールバック
          onError: (error) => {
            console.error("TTSエラー:", error);
            setIsSpeaking(false);
            // エラー時もダイアログを非表示
            setDialogVisible(false);
            // エラー時も動画モーダルを表示
            setVideoModalVisible(true);
          },
          onStopped: () => {
            console.log("音声読み上げが停止されました");
            setIsSpeaking(false);
            setDialogVisible(false);
            // 停止時も動画モーダルを表示
            setVideoModalVisible(true);
          },
        });
      }, 100);
    } catch (e) {
      console.error("TTSエラー:", e);
      setIsSpeaking(false);
      // エラー時もダイアログを非表示
      setDialogVisible(false);
      // エラー時も動画モーダルを表示
      setVideoModalVisible(true);
    }
  };

  // Firebase Functionsのプロセス関数
  const processVoiceCommandFunction = functions.httpsCallable(
    "processVoiceCommand"
  );

  // コマンドの処理を行う関数（debounce処理付き）
  const processWithDebounce = (text: string) => {
    console.log("Debounce処理開始:", text.replace(pastTextRef.current, ""));
    // すでにタイマーがセットされていれば解除
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 新たにタイマーをセット
    debounceTimerRef.current = setTimeout(() => {
      console.log("Debounce完了、コマンド処理:", text);
      processVoiceCommand(text.replace(pastTextRef.current, ""));
      pastTextRef.current = text;
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

      // // 音声認識が終了した時点で最終的なテキストでコマンドを処理
      // if (isProcessingRef.current && currentTextRef.current) {
      //   console.log("音声認識終了時のテキスト:", currentTextRef.current);
      //   // 直接処理せずdebounce処理を行う
      //   processWithDebounce(currentTextRef.current);
      //   isProcessingRef.current = false;
      // }
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

      await Voice.start("ja-JP", {}); // 日本語で音声認識
      setVoiceListening(true);
    } catch (e) {
      console.error(e);
      setError("音声認識の起動に失敗しました");
    }
  };

  // 音声認識の停止
  const stopVoiceRecognition = async () => {
    try {
      await Voice.destroy();
      setVoiceListening(false);
    } catch (e) {
      console.error(e);
      setError("音声認識の停止に失敗しました");
    }
  };

  // 手動テキスト入力を処理する関数（音声認識と同じ処理を行う）
  const processManualTextInput = useCallback((text: string) => {
    if (!text.trim()) return;

    console.log("手動テキスト入力:", text);

    // 認識テキストとして表示
    setRecognizedText(text);

    // 現在の認識テキストを更新
    currentTextRef.current = text;

    // コマンド処理を実行
    processVoiceCommand(text);
  }, []);

  // Firebase FunctionsでLLMを使ってコマンド処理を行う関数
  const processWithLLM = async (text: string) => {
    try {
      setIsProcessingLLM(true);
      // ユーザーに処理中であることを知らせる応答メッセージを設定
      const processingMessage = "質問を処理しています...";
      setLastAIResponse(processingMessage);

      // 先にダイアログを表示状態にして、ユーザーに処理中と伝える
      setDialogVisible(true);

      console.log("processWithLLM", text);

      // 会話履歴にユーザーの発話を追加
      addConversationMessage(text, true);

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

      // Firebase Functions呼び出し（onCallGenkitを使用）
      const result = await processVoiceCommandFunction({
        text,
        recipeContext,
      });

      // 処理中ダイアログを閉じる（結果表示のためにすぐに再表示されます）
      setDialogVisible(false);

      console.log("LLM処理結果:", result);

      // レスポンスの型定義
      interface LLMResponse {
        success: boolean;
        response?: string;
        videoUrl?: string;
        error?: string;
      }

      // データにアクセス
      const data = result.data as LLMResponse;

      if (data.success && data.response) {
        console.log("LLM応答:", data.response);
        setLastAIResponse(data.response);

        // 会話履歴にLLMの応答を追加
        addConversationMessage(data.response, false);

        // 動画URLが存在する場合は、読み上げ後に動画モーダルを表示
        if (data.success && data.videoUrl) {
          // 動画URLが存在する場合
          console.log("動画URL:", data.videoUrl);
          // 動画URLを設定
          setCurrentVideoUrl(data.videoUrl);

          try {
            // 現在話している場合は一旦停止
            if (isSpeaking) {
              await Speech.stop();
            }

            // 先にダイアログを表示状態にする
            console.log("ダイアログを表示します");
            setDialogVisible(true);

            // 少し待ってから読み上げを開始（UIの更新を確実にするため）
            setTimeout(async () => {
              // 日本語で読み上げるようにオプションを設定
              setIsSpeaking(true);
              console.log("音声読み上げを開始します");
              Speech.speak(data.response!, {
                language: "ja-JP",
                // 読み上げ完了時のコールバック
                onDone: () => {
                  console.log("音声読み上げが完了しました");
                  setIsSpeaking(false);
                  // 読み上げ終了後にダイアログを非表示
                  setDialogVisible(false);
                  // 動画モーダルを表示
                  console.log("動画モーダルを表示します");
                  setVideoModalVisible(true);
                },
                // エラー発生時のコールバック
                onError: (error) => {
                  console.error("TTSエラー:", error);
                  setIsSpeaking(false);
                  // エラー時もダイアログを非表示
                  setDialogVisible(false);
                  // エラー時も動画モーダルを表示
                  setVideoModalVisible(true);
                },
                onStopped: () => {
                  console.log("音声読み上げが停止されました");
                  setIsSpeaking(false);
                  setDialogVisible(false);
                  // 停止時も動画モーダルを表示
                  setVideoModalVisible(true);
                },
              });
            }, 100);
          } catch (e) {
            console.error("TTSエラー:", e);
            setIsSpeaking(false);
            // エラー時もダイアログを非表示
            setDialogVisible(false);
            // エラー時も動画モーダルを表示
            setVideoModalVisible(true);
          }
        } else {
          // 動画URLがない場合は通常の応答読み上げ
          speakResponse(data.response);
        }
      } else {
        console.error("LLMエラー:", data.error);
        const errorMessage =
          "申し訳ありません、応答の処理中にエラーが発生しました";
        setLastAIResponse(errorMessage);

        // 会話履歴にエラーメッセージを追加
        addConversationMessage(errorMessage, false);

        // TTSでエラーメッセージを読み上げ
        speakResponse(errorMessage);
      }
    } catch (e: any) {
      console.error("LLM処理エラー:", e, e.message, (e as Error).name);
      const errorMessage = "申し訳ありません、処理中にエラーが発生しました";
      setLastAIResponse(errorMessage);

      // 会話履歴にエラーメッセージを追加
      addConversationMessage(errorMessage, false);

      // TTSでエラーメッセージを読み上げ
      speakResponse(errorMessage);
    } finally {
      setIsProcessingLLM(false);
    }
  };

  // 外部から提供されるGemma 3モデルのみを使用

  // コマンド処理のメイン関数
  const processVoiceCommand = async (text: string) => {
    if (!text.trim()) return; // 空のテキストは処理しない

    // まず外部のコールバックによる処理を試みる
    // もしコールバックがtrueを返したら（コマンドが処理されたら）、ここで終了
    if (callbacks?.onVoiceRecognitionResult) {
      const result = await Promise.resolve(
        callbacks.onVoiceRecognitionResult(text)
      );
      if (result) {
        console.log("外部コールバックでコマンドが処理されました:", text);
        return;
      }
    }

    // すべて小文字で比較して、部分一致でコマンドを処理
    const lowerText = text.toLowerCase();
    console.log("コマンド処理実行:", lowerText);

    // ウェイクワードのチェック
    const hasWakeWord =
      lowerText.startsWith("アイリ") ||
      lowerText.startsWith("あいり") ||
      lowerText.startsWith("エリ") ||
      lowerText.startsWith("えり") ||
      lowerText.startsWith("エアリ") ||
      lowerText.startsWith("えあり");

    // 「あり」で始まる場合の特別処理（「ありがとう」などの一般的な言葉は除外）
    const startsWithAri = lowerText.startsWith("あり");
    const isExcludedAriWord =
      lowerText.startsWith("ありがとう") ||
      lowerText.startsWith("ありました") ||
      lowerText.startsWith("ありませ") ||
      lowerText.startsWith("ありゃ") ||
      lowerText.startsWith("ありゃしない") ||
      lowerText.startsWith("ありえ");

    // 通常のウェイクワードか、「あり」で始まり除外ワードでない場合にtrueに
    const hasWakeWordFinal =
      hasWakeWord || (startsWithAri && !isExcludedAriWord);

    // ウェイクワードがない場合は処理しない
    if (!hasWakeWordFinal) {
      console.log("ウェイクワードがないため処理をスキップ:", lowerText);
      return;
    }

    // ウェイクワードを見つけた場合は「AIry」に置き換えて実際のコマンド部分を抽出
    let detectedWakeWord = "";
    if (lowerText.startsWith("アイリ")) detectedWakeWord = "アイリ";
    else if (lowerText.startsWith("あいり")) detectedWakeWord = "あいり";
    else if (lowerText.startsWith("エリ")) detectedWakeWord = "エリ";
    else if (lowerText.startsWith("えり")) detectedWakeWord = "えり";
    else if (lowerText.startsWith("エアリ")) detectedWakeWord = "エアリ";
    else if (lowerText.startsWith("えあり")) detectedWakeWord = "えあり";
    else if (startsWithAri && !isExcludedAriWord) detectedWakeWord = "あり";

    // 元のテキストからウェイクワードを「AIry」に置き換え
    const processedText = detectedWakeWord
      ? text.replace(new RegExp(`^${detectedWakeWord}`), "AIry")
      : text;

    // 「AIry」の後のコマンド部分を抽出
    const commandText = lowerText
      .replace(/^(アイリ|えり|エリ|あいり|エアリ|えあり|あり)/, "")
      .trim();
    console.log("ウェイクワード検出、処理後のテキスト:", processedText);
    console.log("コマンド処理:", commandText);

    // コマンドが空の場合は標準応答
    if (!commandText) {
      const responseMessage = "はい、何をお手伝いしましょうか？";
      setLastAIResponse(responseMessage);

      // 会話履歴に追加（ウェイクワードが置き換えられた形で追加）
      addConversationMessage(processedText, true); // ウェイクワードが「AIry」に置換されたユーザーの発話
      addConversationMessage(responseMessage, false); // システムの応答

      speakResponse(responseMessage);
      return;
    }

    // 外部から提供されたGemma 3モデルが利用可能な場合はそれを使って基本コマンドを判断する
    if (externalModelHandle) {
      try {
        // Gemma 3モデルに判断させるためのプロンプト
        const prompt = `
次のどのコマンドカテゴリに当てはまるか判断してください:
- next_step: 次へ進む (例: 次、進める、次のステップ)
- previous_step: 前に戻る (例: 戻る、前へ、前のステップ) 
- show_ingredients: 材料を表示 (例: 材料、ざいりょう)
- show_steps: 手順を表示 (例: 手順、ステップ、作り方)
- other_command: その他のコマンド

ユーザー発言: "${commandText}"
カテゴリ名だけを返答: 
`;

        console.log("基本コマンド判定のプロンプト:", prompt);

        // Gemma 3モデルで判定
        const response = await ExpoLlmMediapipe.generateResponse(
          externalModelHandle,
          1,
          prompt
        );
        console.log("Gemma 3モデルの判定結果:", response);

        // レスポンスから余分な空白や改行を削除して小文字に統一
        const command = response.trim().toLowerCase();

        if (command.includes("next_step")) {
          nextStep();
          const responseMessage = "次のステップに進みます";
          setLastAIResponse(responseMessage);

          // 会話履歴に追加
          addConversationMessage(processedText, true);
          addConversationMessage(responseMessage, false);

          speakResponse(responseMessage);
          return true;
        } else if (command.includes("previous_step")) {
          previousStep();
          const responseMessage = "前のステップに戻ります";
          setLastAIResponse(responseMessage);

          // 会話履歴に追加
          addConversationMessage(processedText, true);
          addConversationMessage(responseMessage, false);

          speakResponse(responseMessage);

          return true;
        } else if (command.includes("show_ingredients")) {
          // 材料リストを表示
          const responseMessage = "材料リストを表示します";
          setLastAIResponse(responseMessage);

          // 会話履歴に追加
          addConversationMessage(processedText, true);
          addConversationMessage(responseMessage, false);

          speakResponse(responseMessage);
          // コールバック関数が提供されている場合は実行
          if (callbacks?.onShowIngredients) {
            callbacks.onShowIngredients(true);
          }

          return true;
        } else if (command.includes("show_steps")) {
          // 手順リストを表示
          const responseMessage = "手順リストを表示します";
          setLastAIResponse(responseMessage);

          // 会話履歴に追加
          addConversationMessage(processedText, true);
          addConversationMessage(responseMessage, false);

          speakResponse(responseMessage);
          // 材料表示を無効にする（コールバックが提供されている場合）
          if (callbacks?.onShowIngredients) {
            callbacks.onShowIngredients(false); // 材料を非表示（手順を表示）
          }

          return true;
        }
      } catch (error) {
        console.error("基本コマンド判定エラー:", error);
        // エラーが発生した場合はフォールバックとして従来の方法で判定
      }
    }

    // モデルが使えない場合やエラーが発生した場合は従来の方法で基本コマンドを判定
    // 基本コマンドを先に処理（即時応答が必要なもの）
    if (
      commandText.includes("次") ||
      commandText.includes("次へ") ||
      commandText.includes("進める")
    ) {
      nextStep();
      const responseMessage = "次のステップに進みます";
      setLastAIResponse(responseMessage);

      // 会話履歴に追加（ウェイクワードが置き換えられた形で追加）
      addConversationMessage(processedText, true); // ウェイクワードが「AIry」に置換されたユーザーの指示
      addConversationMessage(responseMessage, false); // システムの応答

      speakResponse(responseMessage); // TTSで応答を読み上げ

      return;
    } else if (
      commandText.includes("戻る") ||
      commandText.includes("前") ||
      commandText.includes("前へ") ||
      commandText.includes("戻って")
    ) {
      previousStep();
      const responseMessage = "前のステップに戻ります";
      setLastAIResponse(responseMessage);

      // 会話履歴に追加（ウェイクワードが置き換えられた形で追加）
      addConversationMessage(processedText, true); // ウェイクワードが「AIry」に置換されたユーザーの指示
      addConversationMessage(responseMessage, false); // システムの応答

      speakResponse(responseMessage); // TTSで応答を読み上げ

      return;
    } else if (
      commandText.includes("材料") ||
      commandText.includes("ざいりょう") ||
      commandText.includes("ingredient")
    ) {
      // 材料リストを表示するための状態更新
      const responseMessage = "材料リストを表示します";
      setLastAIResponse(responseMessage);

      // 会話履歴に追加（ウェイクワードが置き換えられた形で追加）
      addConversationMessage(processedText, true); // ウェイクワードが「AIry」に置換されたユーザーの指示
      addConversationMessage(responseMessage, false); // システムの応答

      speakResponse(responseMessage); // TTSで応答を読み上げ
      // コールバック関数が提供されている場合は実行
      if (callbacks?.onShowIngredients) {
        callbacks.onShowIngredients(true);
      }

      return;
    } else if (
      commandText.includes("手順") ||
      commandText.includes("てじゅん") ||
      commandText.includes("ステップ") ||
      commandText.includes("step")
    ) {
      // 手順リストを表示するための状態更新
      const responseMessage = "手順リストを表示します";
      setLastAIResponse(responseMessage);

      // 会話履歴に追加（ウェイクワードが置き換えられた形で追加）
      addConversationMessage(processedText, true); // ウェイクワードが「AIry」に置換されたユーザーの指示
      addConversationMessage(responseMessage, false); // システムの応答

      speakResponse(responseMessage); // TTSで応答を読み上げ
      // 材料表示を無効にする（コールバックが提供されている場合）
      if (callbacks?.onShowIngredients) {
        callbacks.onShowIngredients(false); // 材料を非表示（手順を表示）
      }

      return;
    }

    // 基本コマンドに該当しない場合はLLMで処理
    processWithLLM(processedText.replace("AIry", "").trim());

    // LLM処理後に音声認識を再開
  };

  return {
    isListening: isVoiceListening,
    isProcessingLLM,
    error,
    isSpeaking, // 音声読み上げ中かどうかの状態を追加
    startVoiceRecognition,
    stopVoiceRecognition,
    processManualTextInput, // 手動テキスト入力処理関数を追加
  };
};
