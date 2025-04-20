import { Ionicons } from "@expo/vector-icons";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  IconButton,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { IngredientsList } from "../../../components/recipe/IngredientsList";
import { StepsList } from "../../../components/recipe/StepsList";
import { useVoiceRecognition } from "../../../hooks/useVoiceRecognition";
import { useRecipeStore } from "../../../store/recipeStore";

export default function CookingModeScreen() {
  const {
    currentRecipe,
    currentStepIndex,
    nextStep,
    previousStep,
    recognizedText,
    lastAIResponse,
    setLastAIResponse,
  } = useRecipeStore();

  const [showIngredients, setShowIngredients] = useState(false);
  const navigation = useNavigation();
  const theme = useTheme();

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

  // 材料リストの表示切替用コールバック
  const handleToggleIngredients = useCallback(
    (show?: boolean) => {
      // showパラメータが指定されていればその値を使用、そうでなければ現在の状態を反転
      setShowIngredients(show !== undefined ? show : !showIngredients);
    },
    [showIngredients]
  );

  // 音声認識フックにコールバックを渡す
  const { isListening, error, startVoiceRecognition, stopVoiceRecognition } =
    useVoiceRecognition({
      onShowIngredients: (isShow: boolean) => handleToggleIngredients(isShow), // 材料表示
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
    <LinearGradient
      colors={["#2c3e50", "#1a1a2e"]}
      style={styles.gradientContainer}
    >
      <Appbar.Header style={styles.transparentHeader}>
        <Appbar.Content
          title={currentRecipe.title}
          titleStyle={styles.headerTitle}
        />
        <Appbar.Action icon="close" color="#fff" onPress={handleClose} />
      </Appbar.Header>

      <SafeAreaView style={styles.containerTransparent}>
        <ScrollView style={styles.content}>
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

        {/* ボタン配置エリア */}
        <SafeAreaView style={styles.buttonsContainer}>
          {/* 音声操作ボタン（左側） */}
          <Button
            mode="contained-tonal"
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
        </SafeAreaView>
      </SafeAreaView>
    </LinearGradient>
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
    flex: 1,
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
    bottom: 24,
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
});
