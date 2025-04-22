import { Ionicons } from "@expo/vector-icons";
import {
  Canvas,
  Rect,
  LinearGradient as SkiaGradient,
  vec,
} from "@shopify/react-native-skia";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Dialog,
  IconButton,
  Portal,
  Surface,
  Text,
} from "react-native-paper";
import {
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IngredientsList } from "../../../components/recipe/IngredientsList";
import { StepsList } from "../../../components/recipe/StepsList";
import { useVoiceRecognition } from "../../../hooks/useVoiceRecognition";
import {
  ConversationMessage,
  useRecipeStore,
} from "../../../store/recipeStore";

const getRandomColor = () => {
  // Generate random RGB color values
  const r = Math.floor(Math.random() * 156 + 100);
  const g = Math.floor(Math.random() * 100 + 50);
  const b = Math.floor(Math.random() * 156 + 100);

  // Return the color in the format 'rgba(r, g, b, 1)'
  return `rgba(${r}, ${g}, ${b}, 1)`;
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
    setDialogVisible, // ダイアログ表示状態を設定する関数
  } = useRecipeStore();

  const [showIngredients, setShowIngredients] = useState(false);

  const { width, height } = Dimensions.get("window");
  const leftColor = useSharedValue("#2c3e50");
  const rightColor = useSharedValue("#1a1a2e");

  // 会話履歴用のFlatListのリファレンス
  const flatListRef = useRef<FlatList>(null);

  const colors = useDerivedValue(() => {
    return [leftColor.value, rightColor.value];
  }, []);

  const { bottom } = useSafeAreaInsets();

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

  // 会話履歴が更新されたら自動スクロールする
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

  // 音声認識フックにコールバックを渡す
  const {
    isListening,
    error,
    isSpeaking,
    startVoiceRecognition,
    stopVoiceRecognition,
  } = useVoiceRecognition({
    onShowIngredients: (isShow: boolean) => handleToggleIngredients(isShow), // 材料表示
  });

  // モーダルを閉じる処理
  const handleClose = () => {
    router.back();
  };

  const interval = useRef<NodeJS.Timeout | null>(null);

  const toggleVoiceRecognition = async () => {
    if (isListening) {
      await stopVoiceRecognition();
      clearInterval(interval.current!);
      leftColor.value = withTiming("#2c3e50", { duration: 300 });
      rightColor.value = withTiming("#1a1a2e", { duration: 300 });
    } else {
      const duration = 2000;
      interval.current = setInterval(() => {
        leftColor.value = withTiming(getRandomColor(), { duration: duration });
        rightColor.value = withTiming(getRandomColor(), { duration: duration });
      }, duration);

      await startVoiceRecognition();
    }
  };

  // 会話メッセージの描画関数
  const renderConversationItem = ({ item }: { item: ConversationMessage }) => {
    // ユーザーメッセージとAIメッセージのスタイルを変える
    const isUserMessage = item.isUser;
    return (
      <Surface
        style={[
          styles.messageItem,
          isUserMessage ? styles.userMessage : styles.aiMessage,
        ]}
        elevation={1}
      >
        <View style={styles.messageHeader}>
          <Text style={{ color: "#fff", fontWeight: "bold" }}>
            {isUserMessage ? "あなた:" : "AIry Recipe:"}
          </Text>
        </View>
        <Text style={styles.messageText}>{item.text}</Text>
      </Surface>
    );
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

        <Appbar.Header style={styles.transparentHeader}>
          <Appbar.Content
            title={currentRecipe.title}
            titleStyle={styles.headerTitle}
          />
          <Appbar.Action icon="close" color="#fff" onPress={handleClose} />
        </Appbar.Header>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          {showIngredients ? (
            <IngredientsList ingredients={currentRecipe.ingredients} />
          ) : (
            <StepsList
              steps={currentRecipe.steps}
              currentStepIndex={currentStepIndex}
              onNextStep={nextStep}
              onPreviousStep={previousStep}
              cookingMode={true}
            />
          )}

          {/* 音声認識フィードバック */}
          {recognizedText ? (
            <Surface style={styles.recognitionFeedback} elevation={1}>
              <Text variant="labelLarge">認識テキスト:</Text>
              <Text style={styles.recognizedText}>{recognizedText}</Text>
            </Surface>
          ) : null}

          {/* 会話履歴の表示 */}
          {conversationHistory.length > 0 && (
            <View style={styles.conversationContainer}>
              <Text style={styles.conversationTitle}>会話履歴</Text>
              <FlatList
                ref={flatListRef}
                data={conversationHistory}
                renderItem={renderConversationItem}
                keyExtractor={(item) => item.id}
                style={styles.conversationList}
                nestedScrollEnabled
              />
            </View>
          )}

          {/* AIレスポンス */}
          {lastAIResponse ? (
            <Surface style={styles.aiResponse} elevation={1}>
              <View style={styles.aiResponseHeader}>
                <Text variant="labelLarge">AIry Recipe:</Text>
                <IconButton
                  icon="close-circle-outline"
                  size={20}
                  onPress={() => setLastAIResponse(null)}
                />
              </View>
              <Text style={styles.aiResponseText}>{lastAIResponse}</Text>
            </Surface>
          ) : null}

          {/* エラーメッセージ */}
          {error ? <Text style={styles.errorText}>エラー: {error}</Text> : null}
        </ScrollView>

        {/* 音声読み上げ中のダイアログ表示 */}
        <Dialog
          visible={(isDialogVisible && lastAIResponse !== null) || true}
          dismissable={false}
          style={styles.dialogContainer}
        >
          <Dialog.Title style={styles.dialogTitle}>AIry Recipe</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>{lastAIResponse}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            {(isSpeaking || true) && (
              <ActivityIndicator
                animating={true}
                color="#fff"
                style={[styles.dialogLoader]}
              />
            )}
          </Dialog.Actions>
        </Dialog>

        {/* ボタン配置エリア */}
        <View style={[styles.buttonsContainer, { bottom: bottom + 8 }]}>
          {/* 音声操作ボタン（左側） */}
          <Button
            mode={isListening ? "contained" : "contained-tonal"}
            onPress={toggleVoiceRecognition}
            style={[styles.actionButton, isListening && styles.listeningButton]}
            icon={({ size, color }) =>
              isListening ? (
                <ActivityIndicator animating={true} color={color} size={size} />
              ) : (
                <Ionicons name="mic" size={size} color={color} />
              )
            }
            contentStyle={styles.actionButtonContent}
          >
            {isListening ? "聞いています..." : "音声で操作"}
          </Button>

          {/* 材料表示ボタン（右側） */}
          <Button
            mode="contained-tonal"
            onPress={() => handleToggleIngredients()}
            style={styles.actionButton}
            icon="format-list-bulleted"
            contentStyle={styles.actionButtonContent}
          >
            {showIngredients ? "手順を表示" : "材料を表示"}
          </Button>
        </View>
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
    bottom: 0,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 30,
  },
  actionButtonContent: {
    height: 56,
  },
  listeningButton: {
    backgroundColor: "#ff6b6b",
  },
  // 流れるグラデーション用のスタイル
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
  flowingGradientContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: Dimensions.get("window").height * 2, // 画面の高さの2倍で流れるエリアを確保
    zIndex: 0,
  },
  flowingGradient: {
    width: "100%",
    height: "100%",
  },
  // 会話履歴用のスタイル
  conversationContainer: {
    marginVertical: 12,
  },
  conversationTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#fff",
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
    color: "#fff",
  },
  // ダイアログ用のスタイル
  dialogContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  dialogTitle: {
    color: "#fff",
  },
  dialogText: {
    color: "#fff",
    fontSize: 24,
  },
  dialogLoader: {
    marginLeft: 8,
  },
});
