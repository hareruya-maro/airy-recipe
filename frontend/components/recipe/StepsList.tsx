import React, { useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Card, Surface, Text } from "react-native-paper";
import { Step } from "../../store/recipeStore";
import { ImageViewerModal } from "./ImageViewerModal";

type StepsListProps = {
  steps: Step[];
  currentStepIndex: number;
  onNextStep: () => void;
  onPreviousStep: () => void;
  cookingMode?: boolean;
};

export const StepsList: React.FC<StepsListProps> = ({
  steps,
  currentStepIndex,
  onNextStep,
  onPreviousStep,
  cookingMode = false,
}) => {
  const currentStep = steps[currentStepIndex];
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // 画像をタップして拡大表示
  const handleImagePress = (imageUri: string) => {
    setSelectedImage(imageUri);
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  if (cookingMode && currentStep) {
    // 料理中モード: 一つのステップのみを大きく表示
    return (
      <Surface style={styles.cookingModeContainer} elevation={2}>
        <Text style={styles.stepNumberCooking}>
          ステップ {currentStepIndex + 1}/{steps.length}
        </Text>

        {currentStep.image && (
          <TouchableOpacity
            onPress={() => handleImagePress(currentStep.image!)}
            style={styles.cookingModeImageContainer}
          >
            <Image
              source={{ uri: currentStep.image }}
              style={styles.cookingModeImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        <Text style={styles.stepTextCooking}>{currentStep.description}</Text>

        <View style={styles.navigationButtonsContainer}>
          <Button
            mode="contained"
            onPress={onPreviousStep}
            disabled={currentStepIndex === 0}
            style={styles.navButton}
          >
            前へ
          </Button>
          <Button
            mode="contained"
            onPress={onNextStep}
            disabled={currentStepIndex === steps.length - 1}
            style={styles.navButton}
          >
            次へ
          </Button>
        </View>

        {selectedImage && (
          <ImageViewerModal
            imageUri={selectedImage}
            isVisible={!!selectedImage}
            onClose={handleCloseModal}
          />
        )}
      </Surface>
    );
  }

  // 通常モード: 全ステップをリスト表示
  return (
    <Surface style={styles.container} elevation={1}>
      <Text variant="titleLarge" style={styles.title}>
        手順
      </Text>
      {steps.map((step, index) => (
        <Card
          key={`step-${index}`}
          style={[
            styles.stepCard,
            currentStepIndex === index && styles.currentStepCard,
          ]}
        >
          <Card.Content>
            <Text style={styles.stepNumber}>ステップ {index + 1}</Text>

            {step.image && (
              <TouchableOpacity
                onPress={() => handleImagePress(step.image!)}
                style={styles.thumbnailContainer}
              >
                <Image
                  source={{ uri: step.image }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}

            <Text style={styles.stepText}>{step.description}</Text>
          </Card.Content>
        </Card>
      ))}

      {selectedImage && (
        <ImageViewerModal
          imageUri={selectedImage}
          isVisible={!!selectedImage}
          onClose={handleCloseModal}
        />
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    borderRadius: 8,
    overflow: "hidden",
    padding: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: "bold",
  },
  stepCard: {
    marginBottom: 12,
  },
  currentStepCard: {
    borderColor: "#2196F3",
    borderWidth: 2,
  },
  stepNumber: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  stepText: {
    fontSize: 16,
  },
  // サムネイル画像スタイル
  thumbnailContainer: {
    marginVertical: 8,
  },
  thumbnailImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
  },
  // 料理中モードのスタイル
  cookingModeContainer: {
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#f8f9fa",
  },
  stepNumberCooking: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  cookingModeImageContainer: {
    marginVertical: 16,
    alignItems: "center",
  },
  cookingModeImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  stepTextCooking: {
    fontSize: 28,
    lineHeight: 36,
    textAlign: "center",
    marginBottom: 32,
  },
  navigationButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  navButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});
