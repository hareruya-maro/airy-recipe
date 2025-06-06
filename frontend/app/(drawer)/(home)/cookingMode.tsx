import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  IconButton,
  Modal,
  Portal,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import YoutubeIframe from "react-native-youtube-iframe";
import { IngredientsList } from "../../../components/recipe/IngredientsList";
import { StepsList } from "../../../components/recipe/StepsList";
import { CookingTimer } from "../../../components/ui/CookingTimer";
import {
  FlowingGradient,
  FlowingGradientRef,
} from "../../../components/ui/FlowingGradient";
import PulsingDialog from "../../../components/ui/PulsingDialog";
import TextInputModal from "../../../components/ui/TextInputModal";
import { useTimer } from "../../../hooks/useTimer";
import { useVoiceRecognition } from "../../../hooks/useVoiceRecognition";
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
    setLastAIResponse,
    conversationHistory, // 会話履歴
    isDialogVisible, // ダイアログ表示状態
    isVideoModalVisible, // 動画モーダル表示状態
    setVideoModalVisible, // 動画モーダル表示状態を設定する関数
    currentVideoUrl, // 現在の動画URL
    setCurrentVideoUrl, // 現在の動画URLを設定する関数
  } = useRecipeStore();

  const [showIngredients, setShowIngredients] = useState(false);

  // FlowingGradientコンポーネントへの参照
  const flowingGradientRef = useRef<FlowingGradientRef>(null);

  // FlatListのリファレンス
  const flatListRef = useRef<FlatList>(null);

  const { bottom } = useSafeAreaInsets();
  const { colors } = useTheme();

  // タイマー機能のhook
  const {
    processVoiceCommand,
    processTimerDialogResponse,
    isDialogVisible: isTimerDialogVisible,
    showManualTimerDialogVisible,
  } = useTimer();

  // テキスト入力モーダルの状態
  const [isTextInputModalVisible, setTextInputModalVisible] = useState(false);

  // 動画プレーヤーのステータスを管理
  const [playing, setPlaying] = useState(false);

  // YouTubeプレーヤーのイベントハンドラー
  const onStateChange = useCallback((state: string) => {
    if (state === "ended") {
      setPlaying(false);
    }
  }, []);

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

  // セクションデータが更新されたら自動スクロールする
  useEffect(() => {
    if (conversationHistory.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [conversationHistory]);

  // 材料リストの表示切替用コールバック
  const handleToggleIngredients = useCallback(
    (show?: boolean) => {
      // showパラメータが指定されていればその値を使用、そうでなければ現在の状態を反転
      setShowIngredients(show !== undefined ? show : !showIngredients);
    },
    [showIngredients]
  );

  // 音声認識の処理ハンドラー（タイマー機能を追加）
  const handleVoiceRecognitionResult = useCallback(
    (text: string) => {
      // 現在のレシピ手順テキストを取得
      const currentStepText =
        currentRecipe?.steps?.[currentStepIndex]?.description || "";

      // タイマー関連の音声コマンドを処理
      if (isTimerDialogVisible) {
        // タイマーダイアログが表示されている場合、確認応答を優先処理
        if (processTimerDialogResponse(text)) {
          return true; // 音声コマンドが処理された
        }
      } else {
        // タイマー設定コマンドを処理
        if (processVoiceCommand(text, currentStepText)) {
          return true; // 音声コマンドが処理された
        }
      }

      // その他の音声コマンド処理（既存のもの）
      return false;
    },
    [
      currentRecipe,
      currentStepIndex,
      isTimerDialogVisible,
      processTimerDialogResponse,
      processVoiceCommand,
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
    onVoiceRecognitionResult: handleVoiceRecognitionResult, // 音声認識結果ハンドラー（タイマー処理含む）
  });

  // モーダルを閉じる処理
  const handleClose = () => {
    router.back();
  };

  const toggleVoiceRecognition = async () => {
    if (isListening) {
      await stopVoiceRecognition();
      // グラデーションのアニメーションを停止
      if (flowingGradientRef.current?.stopColorAnimation) {
        flowingGradientRef.current.stopColorAnimation();
      }
    } else {
      // グラデーションのアニメーションを開始
      if (flowingGradientRef.current?.startColorAnimation) {
        flowingGradientRef.current.startColorAnimation(2000);
      }
      await startVoiceRecognition();
    }
  };

  // 動画モーダルを閉じる
  const closeVideoModal = () => {
    setVideoModalVisible(false);
    setPlaying(false);
    setCurrentVideoUrl(null);
  };

  // YouTubeの動画IDを抽出する関数
  const extractYouTubeID = (url: string | null): string | undefined => {
    if (!url) return undefined;

    // YouTubeのURL形式に一致する正規表現パターン
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^/?]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^/?]+)/,
    ];

    // 各パターンでマッチするか確認
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // マッチしない場合はそのまま返す（既にIDのみの可能性）
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    return undefined;
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

      case "feedback":
        return (
          <Surface style={styles.recognitionFeedback} elevation={1}>
            <Text variant="labelLarge">認識テキスト:</Text>
            <Text style={styles.recognizedText}>{item.data}</Text>
          </Surface>
        );

      case "conversation":
        return (
          <View style={styles.conversationContainer}>
            <Text style={styles.conversationTitle}>会話履歴</Text>
            {item.data.map((message: ConversationMessage) => (
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

      case "aiResponse":
        return (
          <Surface style={styles.aiResponse} elevation={1}>
            <View style={styles.aiResponseHeader}>
              <Text variant="labelLarge">AIry Recipe:</Text>
              <IconButton
                icon="close-circle-outline"
                size={20}
                onPress={() => setLastAIResponse(null)}
              />
            </View>
            <Text style={styles.aiResponseText}>{item.data}</Text>
          </Surface>
        );

      case "error":
        return <Text style={styles.errorText}>エラー: {item.data}</Text>;

      default:
        return null;
    }
  };

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
      <View style={{ flex: 1 }}>
        {/* バックグラウンドのフローグラデーション */}
        <FlowingGradient ref={flowingGradientRef} />

        <Appbar.Header style={styles.transparentHeader}>
          <Appbar.Content
            title={currentRecipe.title}
            titleStyle={styles.headerTitle}
          />
          <Appbar.Action icon="close" color="#fff" onPress={handleClose} />
        </Appbar.Header>

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
            style={[styles.actionButton, isListening && styles.listeningButton]}
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
        <Modal
          visible={isVideoModalVisible}
          onDismiss={closeVideoModal}
          contentContainerStyle={styles.videoModalContainer}
        >
          <View style={styles.videoModalContent}>
            <Text style={styles.videoModalTitle}>料理手順の解説動画</Text>

            <View style={styles.videoPlayerContainer}>
              {currentVideoUrl && extractYouTubeID(currentVideoUrl) && (
                <YoutubeIframe
                  height={(Dimensions.get("window").width - 32) * (9 / 16)}
                  width={Dimensions.get("window").width - 32}
                  videoId={extractYouTubeID(currentVideoUrl) || ""}
                  play={playing}
                  onChangeState={onStateChange}
                  initialPlayerParams={{
                    controls: true,
                    cc_lang_pref: "ja",
                    modestbranding: true,
                    preventFullScreen: false,
                  }}
                />
              )}
            </View>

            <Button
              mode="contained"
              onPress={closeVideoModal}
              style={styles.videoModalCloseButton}
            >
              閉じる
            </Button>
          </View>
        </Modal>
      </View>
    </Portal.Host>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
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
  },
  // 動画モーダル用スタイル
  videoModalContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  videoModalContent: {
    width: "100%",
    backgroundColor: "#121212",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  videoModalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  videoPlayerContainer: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  videoModalCloseButton: {
    width: "100%",
    borderRadius: 30,
  },
});
