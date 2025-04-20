import { Ionicons } from "@expo/vector-icons";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  IconButton,
  Surface,
  Text,
} from "react-native-paper";
import { useVoiceRecognition } from "../../hooks/useVoiceRecognition";
import { useRecipeStore } from "../../store/recipeStore";
import { IngredientsList } from "./IngredientsList";
import { StepsList } from "./StepsList";

type CookingModeProps = {
  visible: boolean; // モーダルの表示状態
  onClose: () => void;
};

export const CookingMode: React.FC<CookingModeProps> = ({
  visible,
  onClose,
}) => {
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

  // アニメーション用のAnimated値
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;

  // アニメーション効果の実行
  useEffect(() => {
    if (visible) {
      // モーダルを表示する際のアニメーション
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // モーダルを閉じる際のアニメーション
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // モーダルを閉じる処理
  const handleClose = () => {
    // 一度アニメーションを逆再生してからonCloseを呼び出す
    Animated.parallel([
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  // スライドアニメーションの計算（下から上へスライド）
  const translateY = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get("window").height, 0],
  });

  // 料理モード中はスリープを防止するためのkeep awake機能
  useEffect(() => {
    if (visible) {
      // モーダルが表示されたらkeep awakeを有効化
      const enableKeepAwake = async () => {
        await activateKeepAwakeAsync();
        console.log("Keep awake activated in cooking mode");
      };

      enableKeepAwake();
    }

    // コンポーネントのアンマウントまたはモーダルが閉じられた時にkeep awakeを無効化
    return () => {
      const disableKeepAwake = async () => {
        await deactivateKeepAwake();
        console.log("Keep awake deactivated");
      };

      disableKeepAwake();
    };
  }, [visible]);

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

  const toggleVoiceRecognition = async () => {
    if (isListening) {
      await stopVoiceRecognition();
    } else {
      await startVoiceRecognition();
    }
  };

  // モーダル内のコンテンツ
  const renderContent = () => {
    if (!currentRecipe) {
      return (
        <SafeAreaView style={styles.container}>
          <Text>レシピが選択されていません</Text>
          <Button mode="contained" onPress={handleClose}>
            戻る
          </Button>
        </SafeAreaView>
      );
    }

    return (
      <>
        <Appbar.Header>
          <Appbar.Content title={currentRecipe.title} />
          <Appbar.Action icon="close" onPress={handleClose} />
        </Appbar.Header>
        <SafeAreaView style={styles.container}>
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
            {error ? (
              <Text style={styles.errorText}>エラー: {error}</Text>
            ) : null}
          </ScrollView>

          {/* ボタン配置エリア */}
          <View style={styles.buttonsContainer}>
            {/* 音声操作ボタン（左側） */}
            <Button
              mode="contained"
              onPress={toggleVoiceRecognition}
              style={[
                styles.actionButton,
                isListening && styles.listeningButton,
              ]}
              icon={({ size, color }) =>
                isListening ? (
                  <ActivityIndicator
                    animating={true}
                    color={color}
                    size={size}
                  />
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
              mode="contained"
              onPress={() => handleToggleIngredients()}
              style={styles.actionButton}
              icon="format-list-bulleted"
              contentStyle={styles.actionButtonContent}
            >
              {showIngredients ? "手順を表示" : "材料を表示"}
            </Button>
          </View>
        </SafeAreaView>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none" // カスタムアニメーションを使用するためにnone
      onRequestClose={handleClose}
    >
      {/* 背景のオーバーレイ */}
      <Animated.View
        style={[styles.overlay, { opacity: fadeAnimation }]}
        onTouchEnd={handleClose} // 背景タップでモーダルを閉じる
      />

      {/* モーダルのコンテンツ */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        {renderContent()}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    marginTop: 50, // 上部に余白を設定
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontWeight: "bold",
  },
  closeButton: {
    margin: 0,
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
    backgroundColor: "#f0f4ff",
  },
  recognizedText: {
    fontSize: 16,
    marginTop: 4,
  },
  aiResponse: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    backgroundColor: "#e6f7ff",
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
    color: "red",
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
