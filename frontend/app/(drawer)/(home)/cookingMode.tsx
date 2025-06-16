import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import ExpoLlmMediapipe from "expo-llm-mediapipe";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, View } from "react-native";
import { Appbar, Button, Portal, Surface, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IngredientsList } from "../../../components/recipe/IngredientsList";
import { StepsList } from "../../../components/recipe/StepsList";
import { CookingTimer } from "../../../components/ui/CookingTimer";
import PulsingDialog from "../../../components/ui/PulsingDialog";
import TextInputModal from "../../../components/ui/TextInputModal";
import { VideoModal, VideoModalRef } from "../../../components/ui/VideoModal";
import { useTimer } from "../../../hooks/useTimer";
import { useVoiceRecognition } from "../../../hooks/useVoiceRecognition";
import { useModelStore } from "../../../store/modelStore";
import {
  ConversationMessage,
  useRecipeStore,
} from "../../../store/recipeStore";

// セクションデータの型定義
type SectionType = {
  id: string;
  type:
    | "timer"
    | "content"
    | "feedback"
    | "conversation"
    | "aiResponse"
    | "error";
  data: any;
};

export default function CookingModeScreen() {
  const {
    currentRecipe,
    currentStepIndex,
    nextStep,
    previousStep,
    recognizedText,
    lastAIResponse,
    conversationHistory, // 会話履歴
    isDialogVisible, // ダイアログ表示状態
    isVideoModalVisible, // 動画モーダル表示状態
    setVideoModalVisible, // 動画モーダル表示状態を設定する関数
    currentVideoUrl, // 現在の動画URL
    setCurrentVideoUrl, // 現在の動画URLを設定する関数
  } = useRecipeStore();

  const [showIngredients, setShowIngredients] = useState(false);
  // モデルハンドルをStoreから取得
  const { modelHandle } = useModelStore();

  // FlatListのリファレンス
  const flatListRef = useRef<FlatList>(null);

  // VideoModalへの参照
  const videoModalRef = useRef<VideoModalRef>(null);

  const { bottom } = useSafeAreaInsets();

  // タイマー機能のhook
  const {
    processVoiceCommand,
    processTimerDialogResponse,
    isDialogVisible: isTimerDialogVisible,
    showManualTimerDialogVisible,
  } = useTimer();

  // テキスト入力モーダルの状態
  const [isTextInputModalVisible, setTextInputModalVisible] = useState(false);

  // テキスト入力モーダルの表示切替
  const toggleTextInputModal = () => {
    setTextInputModalVisible(!isTextInputModalVisible);
  };

  // テキスト入力モーダルからのテキスト提出処理
  const handleTextInputSubmit = (text: string) => {
    // モーダルを閉じる
    setTextInputModalVisible(false);

    // テキストを音声認識結果として処理
    if (text.trim()) {
      // 音声認識の処理を使用してテキストを処理
      processManualTextInput(text);
    }
  };

  // 料理モード中はスリープを防止するためのkeep awake機能
  useEffect(() => {
    // コンポーネントのマウント時にkeep awakeを有効化
    const enableKeepAwake = async () => {
      await activateKeepAwakeAsync();
      console.log("Keep awake activated in cooking mode");
    };

    enableKeepAwake();

    // コンポーネントのアンマウント時にkeep awakeを無効化
    return () => {
      const disableKeepAwake = async () => {
        await deactivateKeepAwake();
        console.log("Keep awake deactivated");
      };

      disableKeepAwake();
    };
  }, []);

  // モデルステータスを確認
  useEffect(() => {
    if (modelHandle === null) {
      console.log(
        "警告: モデルハンドルがnullです。音声機能が正常に動作しない可能性があります。"
      );
    } else {
      console.log(`クッキングモードでモデルハンドルを使用: ${modelHandle}`);
    }
  }, [modelHandle]); // モデルハンドルが変更されたときに実行

  // 材料リストの表示切替用コールバック
  const handleToggleIngredients = useCallback(
    (show?: boolean) => {
      // showパラメータが指定されていればその値を使用、そうでなければ現在の状態を反転
      setShowIngredients(show !== undefined ? show : !showIngredients);
    },
    [showIngredients]
  );

  // 動画関連の音声コマンドを処理するコールバック関数
  const handleVideoCommands = useCallback(
    async (text: string): Promise<boolean> => {
      // 動画モーダルが表示されていない場合は処理しない
      if (!isVideoModalVisible || !videoModalRef.current || !modelHandle) {
        return false;
      }

      try {
        // プロンプトを英語に変更し、柔軟な認識を追加
        const prompt = `
Analyze the user's statement and determine if it's a command related to the video player.
If it is a command, identify which action should be taken from the following categories:

- play: Play the video
  Examples: "play", "start", "play the video", "continue", "resume", "start playing"
- pause: Pause the video
  Examples: "pause", "stop", "pause the video", "wait", "halt"
- toggle_play: Toggle between play and pause
  Examples: "toggle", "toggle play", "switch play status", "play/pause"
- fullscreen: Switch to fullscreen mode
  Examples: "fullscreen", "enlarge", "maximize", "show in full screen", "expand" 
- close: Close the video player
  Examples: "close", "exit", "close the video", "end", "quit", "stop showing"
- not_command: Not a video player related command

Look for the intent behind the statement, not just exact matches. Understand similar commands even if the phrasing is different.

User's statement: "${text}"

Reply with ONLY the category name from above. For example: "play", "pause", etc.
`;

        console.log("動画コマンド判定のプロンプト:", prompt);

        // Gemma 3モデルで判定
        const response = await ExpoLlmMediapipe.generateResponse(
          modelHandle,
          1,
          prompt
        );
        console.log("Gemma 3モデルの判定結果:", response);

        // レスポンスから余分な空白や改行を削除して小文字に統一
        const command = response.trim().toLowerCase();

        // コマンドに応じたアクションを実行
        if (command.includes("play") && !command.includes("toggle")) {
          videoModalRef.current.play();
          return true;
        } else if (command.includes("pause")) {
          videoModalRef.current.pause();
          return true;
        } else if (
          command.includes("toggle_play") ||
          command.includes("toggle")
        ) {
          videoModalRef.current.togglePlay();
          return true;
        } else if (command.includes("fullscreen")) {
          videoModalRef.current.toggleFullscreen();
          return true;
        } else if (command.includes("close")) {
          setVideoModalVisible(false);
          return true;
        }
      } catch (error) {
        console.error("動画コマンド判定エラー:", error);
      }

      return false;
    },
    [isVideoModalVisible, modelHandle, setVideoModalVisible]
  );

  // 音声認識の処理ハンドラー（タイマー機能と動画制御を追加）
  const handleVoiceRecognitionResult = useCallback(
    async (text: string) => {
      // 動画関連コマンドを先に処理
      if (await handleVideoCommands(text)) {
        return true; // 動画コマンドが処理された
      }

      // 現在のレシピ手順テキストを取得
      const currentStepText =
        currentRecipe?.steps?.[currentStepIndex]?.description || "";

      // タイマー関連の音声コマンドを処理
      if (isTimerDialogVisible) {
        // タイマーダイアログが表示されている場合、確認応答を優先処理
        if (await processTimerDialogResponse(text, modelHandle)) {
          return true; // 音声コマンドが処理された
        }
      } else {
        // タイマー設定コマンドを処理
        if (
          text.includes("タイマー") &&
          (await processVoiceCommand(text, currentStepText, modelHandle))
        ) {
          return true; // 音声コマンドが処理された
        }
      }

      // その他の音声コマンド処理（既存のもの）
      return false;
    },
    [
      handleVideoCommands,
      currentRecipe,
      currentStepIndex,
      isTimerDialogVisible,
      processTimerDialogResponse,
      processVoiceCommand,
      modelHandle, // modelHandleを依存配列に追加
    ]
  );

  // 音声認識フックにコールバックを渡す
  const {
    isListening,
    error,
    isSpeaking,
    startVoiceRecognition,
    stopVoiceRecognition,
    processManualTextInput, // 手動テキスト入力処理関数を取得
  } = useVoiceRecognition({
    onShowIngredients: (isShow: boolean) => handleToggleIngredients(isShow), // 材料表示
    onVoiceRecognitionResult: handleVoiceRecognitionResult, // 音声認識結果ハンドラー（タイマー処理と動画制御含む）
    modelHandle: modelHandle, // Gemma 3モデルハンドルを渡す
  });

  // モーダルを閉じる処理
  const handleClose = () => {
    router.back();
  };

  const toggleVoiceRecognition = async () => {
    if (isListening) {
      await stopVoiceRecognition();
    } else {
      await startVoiceRecognition();
    }
  };

  // 動画モーダルを閉じる
  const closeVideoModal = () => {
    setVideoModalVisible(false);
    setCurrentVideoUrl(null);
  };

  // 表示するセクションデータを作成
  const getSectionData = (): SectionType[] => {
    const sections: SectionType[] = [];

    // タイマーセクション
    if (currentRecipe) {
      sections.push({
        id: "timer",
        type: "timer",
        data: currentRecipe.steps[currentStepIndex]?.description || "",
      });
    }

    // メインコンテンツ（材料または手順）
    sections.push({
      id: "content",
      type: "content",
      data: showIngredients
        ? { type: "ingredients", ingredients: currentRecipe?.ingredients }
        : { type: "steps", steps: currentRecipe?.steps, currentStepIndex },
    });

    // 音声認識フィードバック
    if (recognizedText) {
      sections.push({
        id: "feedback",
        type: "feedback",
        data: recognizedText,
      });
    }

    // 会話履歴
    if (conversationHistory.length > 0) {
      sections.push({
        id: "conversation",
        type: "conversation",
        data: conversationHistory,
      });
    }

    // AIレスポンス
    if (lastAIResponse) {
      sections.push({
        id: "aiResponse",
        type: "aiResponse",
        data: lastAIResponse,
      });
    }

    // エラー
    if (error) {
      sections.push({
        id: "error",
        type: "error",
        data: error,
      });
    }

    return sections;
  };

  // セクションアイテムの描画関数
  const renderSectionItem = ({ item }: { item: SectionType }) => {
    switch (item.type) {
      case "timer":
        return <CookingTimer currentStep={item.data} />;

      case "content":
        return item.data.type === "ingredients" ? (
          <IngredientsList ingredients={item.data.ingredients} />
        ) : (
          <StepsList
            steps={item.data.steps}
            currentStepIndex={item.data.currentStepIndex}
            onNextStep={nextStep}
            onPreviousStep={previousStep}
            cookingMode={true}
          />
        );

      case "conversation":
        return (
          <View style={styles.conversationContainer}>
            <Text style={styles.conversationTitle}>会話履歴</Text>
            {/* 新しいものから順に表示 */}
            {item.data
              .slice() // 元配列を変更しないようコピー
              .reverse()
              .map((message: ConversationMessage) => (
                <Surface
                  key={message.id}
                  style={[
                    styles.messageItem,
                    message.isUser ? styles.userMessage : styles.aiMessage,
                  ]}
                  elevation={1}
                >
                  <View style={styles.messageHeader}>
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      {message.isUser ? "あなた:" : "AIry Recipe:"}
                    </Text>
                  </View>
                  <Text style={styles.messageText}>{message.text}</Text>
                </Surface>
              ))}
          </View>
        );

      case "error":
        return <Text style={styles.errorText}>エラー: {item.data}</Text>;

      default:
        return null;
    }
  };

  // グラデーションの色を定義
  const normalGradientColors: readonly [string, string, string] = [
    "#0a1433",
    "#051036",
    "#000428",
  ]; // 通常時の濃紺グラデーション
  const listeningGradientColors: readonly [string, string, string] = [
    "#4a1042",
    "#7a1155",
    "#a01c65",
  ]; // 音声操作時のピンク/紫グラデーション

  if (!currentRecipe) {
    return (
      <LinearGradient
        colors={["#2c3e50", "#1a1a2e"]}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.containerTransparent}>
          <Text style={styles.errorTitle}>レシピが選択されていません</Text>
          <Button mode="contained" onPress={handleClose}>
            戻る
          </Button>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <Portal.Host>
      <StatusBar style="light" />
      <LinearGradient
        colors={isListening ? listeningGradientColors : normalGradientColors}
        style={styles.gradientContainer}
      >
        <View style={{ flex: 1 }}>
          <Appbar.Header style={styles.transparentHeader}>
            <Appbar.Content
              title={currentRecipe.title}
              titleStyle={styles.headerTitle}
            />
            <Appbar.Action icon="close" color="#fff" onPress={handleClose} />
          </Appbar.Header>

          {/* 音声認識状態インジケーター - 音声認識中のみ表示 */}
          {isListening && (
            <View style={styles.listeningIndicator}>
              <Text style={styles.listeningText}>音声操作モード</Text>
            </View>
          )}

          {/* 単一のFlatListでコンテンツを表示 */}
          <FlatList
            ref={flatListRef}
            data={getSectionData()}
            renderItem={renderSectionItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.content}
          />

          {/* 音声読み上げ中のダイアログ表示（パルスアニメーション付き） */}
          <PulsingDialog
            visible={isDialogVisible && lastAIResponse !== null}
            title="AIry Recipe"
            message={lastAIResponse}
            isLoading={isSpeaking}
            minOpacity={0.8}
            maxOpacity={1.0}
            pulseDuration={1000}
          />

          {/* ボタン配置エリア */}
          <View style={[styles.buttonsContainer, { bottom: bottom + 8 }]}>
            {/* 音声操作ボタン（左側） */}
            <Button
              mode={isListening ? "contained" : "contained-tonal"}
              onPress={toggleVoiceRecognition}
              onLongPress={toggleTextInputModal} // 長押しでテキスト入力モーダルを表示
              style={[
                styles.actionButton,
                isListening && styles.listeningButton,
              ]}
              icon={isListening ? "ear-hearing" : "microphone"}
              contentStyle={styles.actionButtonContent}
              delayLongPress={500} // 長押し認識の遅延時間（ミリ秒）
            >
              {isListening ? "聞いています..." : "音声操作"}
            </Button>

            <Button
              mode={"contained-tonal"}
              onPress={showManualTimerDialogVisible}
              style={[styles.actionButton]}
              icon={"alarm"}
              contentStyle={styles.actionButtonContent}
            >
              タイマー
            </Button>

            {/* 材料表示ボタン（右側） */}
            <Button
              mode="contained-tonal"
              onPress={() => handleToggleIngredients()}
              style={styles.actionButton}
              icon="format-list-bulleted"
              contentStyle={styles.actionButtonContent}
            >
              {showIngredients ? "手順" : "材料"}
            </Button>
          </View>

          {/* テキスト入力モーダル */}
          <TextInputModal
            visible={isTextInputModalVisible}
            onDismiss={() => setTextInputModalVisible(false)}
            onSubmit={handleTextInputSubmit}
            title="音声コマンドをテスト"
            placeholder="ウェイクワード（アイリ等）から始めるコマンドを入力してください"
            submitLabel="送信"
            cancelLabel="キャンセル"
          />

          {/* YouTube動画モーダル */}
          <VideoModal
            ref={videoModalRef}
            visible={isVideoModalVisible}
            onClose={closeVideoModal}
            videoUrl={currentVideoUrl}
          />
        </View>
      </LinearGradient>
    </Portal.Host>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  containerTransparent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  transparentHeader: {
    backgroundColor: "transparent",
    elevation: 0,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "bold",
  },
  errorTitle: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    marginVertical: 20,
  },
  content: {
    padding: 16,
    paddingBottom: 80, // 下部ボタンの高さ分の余白を追加
  },
  recognitionFeedback: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    backgroundColor: "rgba(240, 244, 255, 0.9)",
  },
  recognizedText: {
    fontSize: 16,
    marginTop: 4,
  },
  aiResponse: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    backgroundColor: "rgba(230, 247, 255, 0.9)",
  },
  aiResponseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aiResponseText: {
    fontSize: 16,
    marginTop: 4,
  },
  errorText: {
    color: "#ff6b6b",
    marginVertical: 8,
  },
  // 下部ボタン配置用のコンテナ
  buttonsContainer: {
    position: "absolute",
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 30,
  },
  actionButtonContent: {
    height: 56,
  },
  listeningButton: {
    backgroundColor: "#ff6b6b",
  },
  // 会話履歴用のスタイル
  conversationContainer: {
    marginVertical: 12,
  },
  conversationTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  conversationList: {
    maxHeight: 200, // 会話履歴の最大高さを設定
  },
  messageItem: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  userMessage: {
    backgroundColor: "rgba(0, 123, 255, 0.8)",
  },
  aiMessage: {
    backgroundColor: "rgba(255, 193, 7, 0.8)",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  messageText: {
    fontSize: 16,
    marginTop: 4,
    color: "#fff", // テキストを白色に変更して背景に対して読みやすく
  },
  // 音声操作モードインジケーター
  listeningIndicator: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: 8,
    borderRadius: 16,
    margin: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  listeningText: {
    color: "#fff",
    fontWeight: "bold",
  },
  // スタイル終了
});
