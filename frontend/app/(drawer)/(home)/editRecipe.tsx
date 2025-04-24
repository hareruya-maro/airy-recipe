import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../../config/firebase";
import { imageService } from "../../../services/imageService";
import { RecipeUpdate } from "../../../services/recipeService";
import { Recipe, useRecipeStore } from "../../../store/recipeStore";

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, fetchRecipeDetails, updateRecipe } = useRecipeStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // レシピの初期ロード済みかどうかを追跡
  const isInitialLoadDone = useRef(false);

  // ローディングと保存状態
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // 編集用のレシピ状態
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mainImage, setMainImage] = useState<string>("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [ingredients, setIngredients] = useState<
    { name: string; amount: string }[]
  >([]);
  const [steps, setSteps] = useState<{ description: string; image?: string }[]>(
    []
  );
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  // タグ編集用
  const [tagDialogVisible, setTagDialogVisible] = useState(false);
  const [newTag, setNewTag] = useState("");

  // 画像選択ダイアログ
  const [imageDialogVisible, setImageDialogVisible] = useState(false);
  const [currentImageTarget, setCurrentImageTarget] = useState<{
    type: "main" | "step";
    index?: number;
  } | null>(null);

  // レシピデータの取得（初回のみ実行）
  useEffect(() => {
    // すでにロードが完了している場合は実行しない
    if (isInitialLoadDone.current) return;

    if (!id) {
      setError("レシピIDが指定されていません");
      return;
    }

    const loadRecipe = async () => {
      setIsLoading(true);
      try {
        // キャッシュ確認
        const cachedRecipe = recipes.find((r) => r.id === id);
        if (!cachedRecipe) {
          setError("レシピが見つかりません");
          return;
        } else if (
          (cachedRecipe?.ingredients?.length ?? 0) > 0 &&
          (cachedRecipe?.steps?.length ?? 0) > 0
        ) {
          initializeFormWithRecipe(cachedRecipe);
          // 権限チェックも同時に実行
          checkPermission(cachedRecipe);
        } else {
          // 詳細情報を取得
          const recipe = await fetchRecipeDetails(id as string);
          initializeFormWithRecipe(recipe);
          // 権限チェック
          checkPermission(recipe);
        }
        setError(null);
        // 初期ロード完了をマーク
        isInitialLoadDone.current = true;
      } catch (err) {
        console.error("レシピ詳細の取得に失敗:", err);
        setError("レシピの読み込みに失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    loadRecipe();
  }, [id, fetchRecipeDetails]); // recipesを依存配列から削除

  // 権限チェック関数を別関数として切り出し
  const checkPermission = (recipe: Recipe) => {
    if (!recipe) return;

    const currentUserId = auth.currentUser?.uid;

    // システムレシピ、または自分のレシピでない場合は編集不可
    if (recipe.isSystemRecipe || recipe.createdBy !== currentUserId) {
      Alert.alert("編集権限がありません", "このレシピは編集できません。", [
        {
          text: "詳細画面に戻る",
          onPress: () => router.back(),
        },
      ]);
    }
  };

  // フォームの初期化
  const initializeFormWithRecipe = (recipe: Recipe) => {
    setTitle(recipe.title);
    setDescription(recipe.description);
    setMainImage(recipe.image || "");
    // 分単位の数値に変換（末尾の「分」を削除）
    setPrepTime(recipe.prepTime.replace("分", ""));
    setCookTime(recipe.cookTime.replace("分", ""));
    setServings(recipe.servings.toString());
    setDifficulty(recipe.difficulty);
    setIngredients(recipe.ingredients);
    setSteps(
      recipe.steps.map((step) => ({
        description: step.description,
        image: step.image,
      }))
    );
    setTags(recipe.tags || []);
    setIsPublic(recipe.isPublic || false);
  };

  // 画像選択ダイアログを表示
  const showImagePicker = (type: "main" | "step", index?: number) => {
    setCurrentImageTarget({ type, index });
    setImageDialogVisible(true);
  };

  // 画像を選択（ギャラリーから）
  const handlePickImage = async () => {
    if (!currentImageTarget || !id) return;

    try {
      setImageDialogVisible(false);
      const imageUri = await imageService.pickFromGallery();

      if (!imageUri) return; // 画像選択キャンセル

      setIsUploading(true);
      setSnackbarMessage("画像をアップロード中...");
      setSnackbarVisible(true);

      if (currentImageTarget.type === "main") {
        // メイン画像をアップロード
        const downloadUrl = await imageService.uploadRecipeImage(
          id,
          imageUri,
          "main"
        );
        setMainImage(downloadUrl);
      } else if (
        currentImageTarget.type === "step" &&
        typeof currentImageTarget.index === "number"
      ) {
        // 手順画像をアップロード
        const stepIndex = currentImageTarget.index;
        const downloadUrl = await imageService.uploadRecipeImage(
          id,
          imageUri,
          `step_${stepIndex + 1}`
        );

        const newSteps = [...steps];
        newSteps[stepIndex] = {
          ...newSteps[stepIndex],
          image: downloadUrl,
        };
        setSteps(newSteps);
      }

      setSnackbarMessage("画像をアップロードしました");
    } catch (err) {
      console.error("画像アップロードエラー:", err);
      setSnackbarMessage("画像のアップロードに失敗しました");
    } finally {
      setIsUploading(false);
      setSnackbarVisible(true);
    }
  };

  // 写真を撮影
  const handleTakePhoto = async () => {
    if (!currentImageTarget || !id) return;

    try {
      setImageDialogVisible(false);
      const imageUri = await imageService.takePhoto();

      if (!imageUri) return; // 写真撮影キャンセル

      setIsUploading(true);
      setSnackbarMessage("画像をアップロード中...");
      setSnackbarVisible(true);

      if (currentImageTarget.type === "main") {
        // メイン画像をアップロード
        const downloadUrl = await imageService.uploadRecipeImage(
          id,
          imageUri,
          "main"
        );
        setMainImage(downloadUrl);
      } else if (
        currentImageTarget.type === "step" &&
        typeof currentImageTarget.index === "number"
      ) {
        // 手順画像をアップロード
        const stepIndex = currentImageTarget.index;
        const downloadUrl = await imageService.uploadRecipeImage(
          id,
          imageUri,
          `step_${stepIndex + 1}`
        );

        const newSteps = [...steps];
        newSteps[stepIndex] = {
          ...newSteps[stepIndex],
          image: downloadUrl,
        };
        setSteps(newSteps);
      }

      setSnackbarMessage("画像をアップロードしました");
    } catch (err) {
      console.error("画像アップロードエラー:", err);
      setSnackbarMessage("画像のアップロードに失敗しました");
    } finally {
      setIsUploading(false);
      setSnackbarVisible(true);
    }
  };

  // 画像を削除
  const handleRemoveImage = () => {
    setImageDialogVisible(false);
    if (!currentImageTarget) return;

    try {
      if (currentImageTarget.type === "main") {
        // メイン画像の削除
        if (mainImage) {
          // Firebase Storageからの削除はオプション
          // imageService.deleteImage(mainImage);
          setMainImage("");
          setSnackbarMessage("メイン画像を削除しました");
          setSnackbarVisible(true);
        }
      } else if (
        currentImageTarget.type === "step" &&
        typeof currentImageTarget.index === "number"
      ) {
        // 手順画像の削除
        const stepIndex = currentImageTarget.index;
        const stepImage = steps[stepIndex]?.image;

        if (stepImage) {
          // Firebase Storageからの削除はオプション
          // imageService.deleteImage(stepImage);

          const newSteps = [...steps];
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            image: undefined,
          };
          setSteps(newSteps);
          setSnackbarMessage("手順画像を削除しました");
          setSnackbarVisible(true);
        }
      }
    } catch (err) {
      console.error("画像削除エラー:", err);
      setSnackbarMessage("画像の削除に失敗しました");
      setSnackbarVisible(true);
    }
  };

  // 材料の追加
  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", amount: "" }]);
  };

  // 材料の削除
  const removeIngredient = (index: number) => {
    const newIngredients = [...ingredients];
    newIngredients.splice(index, 1);
    setIngredients(newIngredients);
  };

  // 材料の更新
  const updateIngredient = (
    index: number,
    field: "name" | "amount",
    value: string
  ) => {
    const newIngredients = [...ingredients];
    newIngredients[index][field] = value;
    setIngredients(newIngredients);
  };

  // 手順の追加
  const addStep = () => {
    setSteps([...steps, { description: "" }]);
  };

  // 手順の削除
  const removeStep = (index: number) => {
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    setSteps(newSteps);
  };

  // 手順の更新
  const updateStep = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index].description = value;
    setSteps(newSteps);
  };

  // タグの追加
  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
    setTagDialogVisible(false);
  };

  // タグの削除
  const removeTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    setTags(newTags);
  };

  // レシピの保存
  const saveRecipe = async () => {
    if (!id || !title || !description) {
      Alert.alert("エラー", "タイトルと説明は必須項目です");
      return;
    }

    // Firebaseでは数値型として保存するため、文字列から数値に変換
    const prepTimeNum = parseInt(prepTime, 10) || 0;
    const cookTimeNum = parseInt(cookTime, 10) || 0;
    const servingsNum = parseInt(servings, 10) || 2;

    // レシピの更新データを作成
    const recipeUpdate: RecipeUpdate = {
      title,
      description,
      prepTime: prepTimeNum,
      cookTime: cookTimeNum,
      servings: servingsNum,
      difficulty,
      tags,
      isPublic,
      image: mainImage || undefined,
      ingredients: ingredients.map((ing) => {
        // 数量と単位を分離（例: "100g" -> { quantity: 100, unit: "g" }）
        let quantity = 0;
        let unit = "";

        if (ing.amount) {
          const match = ing.amount.match(/(\d+\.?\d*|\.\d+)\s*([^\d]*)/);
          if (match) {
            quantity = parseFloat(match[1]) || 0;
            unit = match[2]?.trim() || "";
          } else {
            unit = ing.amount.trim();
          }
        }

        return {
          name: ing.name,
          quantity,
          unit,
          note: "",
        };
      }),
      steps: steps.map((step) => ({
        instruction: step.description,
        imageUrl: step.image,
      })),
    };

    setIsSaving(true);
    try {
      const result = await updateRecipe(id, recipeUpdate);
      if (result) {
        setSnackbarMessage("レシピを更新しました");
        setSnackbarVisible(true);
        // 詳細画面へ戻る（遅延させてSnackbarを表示する）
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        throw new Error("レシピの更新に失敗しました");
      }
    } catch (err) {
      console.error("レシピ更新エラー:", err);
      setError(
        `レシピの更新に失敗しました: ${
          err instanceof Error ? err.message : "不明なエラー"
        }`
      );
      setSnackbarMessage(
        `エラー: ${err instanceof Error ? err.message : "不明なエラー"}`
      );
      setSnackbarVisible(true);
    } finally {
      setIsSaving(false);
    }
  };

  // 編集のキャンセル
  const cancelEdit = () => {
    Alert.alert("編集を中止しますか？", "変更内容は保存されません。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "はい",
        onPress: () => router.back(),
        style: "destructive",
      },
    ]);
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>レシピ情報を読み込み中...</Text>
      </View>
    );
  }

  // エラー表示
  if (error) {
    return (
      <View style={styles.container}>
        <Text variant="headlineMedium">{error}</Text>
        <Button
          mode="contained"
          onPress={() => router.back()}
          style={styles.button}
        >
          戻る
        </Button>
      </View>
    );
  }

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={cancelEdit} />
        <Appbar.Content title="レシピの編集" />
        <Appbar.Action
          icon="check"
          onPress={saveRecipe}
          disabled={isSaving || isUploading}
        />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        <Surface style={styles.formSection}>
          {/* メイン画像 */}
          <View style={styles.mainImageSection}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              メイン画像
            </Text>
            <TouchableOpacity
              style={styles.mainImageContainer}
              onPress={() => showImagePicker("main")}
              disabled={isUploading}
            >
              {mainImage ? (
                <Image
                  source={{ uri: mainImage }}
                  style={styles.mainImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.mainImagePlaceholder}>
                  <IconButton icon="camera" size={40} />
                  <Text>タップして画像を追加</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TextInput
            label="レシピタイトル"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />

          <TextInput
            label="説明"
            value={description}
            onChangeText={setDescription}
            multiline
            style={styles.input}
          />

          <View style={styles.row}>
            <TextInput
              label="準備時間（分）"
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              label="調理時間（分）"
              value={cookTime}
              onChangeText={setCookTime}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>

          <View style={styles.row}>
            <TextInput
              label="人数"
              value={servings}
              onChangeText={setServings}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              label="難易度"
              value={difficulty}
              onChangeText={setDifficulty}
              style={[styles.input, styles.halfInput]}
            />
          </View>

          {/* タグセクション */}
          <View style={styles.tagsSection}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">タグ</Text>
              <IconButton
                icon="plus"
                size={20}
                onPress={() => setTagDialogVisible(true)}
              />
            </View>
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <Chip
                  key={index}
                  style={styles.tag}
                  mode="outlined"
                  onClose={() => removeTag(index)}
                >
                  {tag}
                </Chip>
              ))}
              {tags.length === 0 && (
                <Text style={styles.placeholderText}>タグなし</Text>
              )}
            </View>
          </View>

          {/* 公開設定 */}
          <View style={styles.publicSection}>
            <Text variant="titleMedium">公開設定</Text>
            <View style={styles.publicToggle}>
              <Text>非公開</Text>
              <IconButton
                icon={isPublic ? "toggle-switch" : "toggle-switch-off"}
                size={36}
                onPress={() => setIsPublic(!isPublic)}
                iconColor={isPublic ? "#4CAF50" : "#757575"}
              />
              <Text>公開</Text>
            </View>
          </View>

          {/* 材料セクション */}
          <View style={styles.ingredientsSection}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">材料</Text>
              <IconButton icon="plus" size={20} onPress={addIngredient} />
            </View>

            {ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientRow}>
                <TextInput
                  label={`材料 ${index + 1}`}
                  value={ingredient.name}
                  onChangeText={(value) =>
                    updateIngredient(index, "name", value)
                  }
                  style={[styles.input, { flex: 2 }]}
                />
                <TextInput
                  label="分量"
                  value={ingredient.amount}
                  onChangeText={(value) =>
                    updateIngredient(index, "amount", value)
                  }
                  style={[styles.input, { flex: 1, marginLeft: 8 }]}
                />
                <IconButton
                  icon="close"
                  size={20}
                  onPress={() => removeIngredient(index)}
                />
              </View>
            ))}

            {ingredients.length === 0 && (
              <Text style={styles.placeholderText}>材料を追加してください</Text>
            )}
          </View>

          {/* 手順セクション */}
          <View style={styles.stepsSection}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">手順</Text>
              <IconButton icon="plus" size={20} onPress={addStep} />
            </View>

            {steps.map((step, index) => (
              <View key={index} style={styles.stepContainer}>
                <View style={styles.stepHeader}>
                  <Text variant="titleSmall">手順 {index + 1}</Text>
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={() => removeStep(index)}
                  />
                </View>
                <TextInput
                  value={step.description}
                  onChangeText={(value) => updateStep(index, value)}
                  multiline
                  style={styles.input}
                />

                {/* 手順画像 */}
                <TouchableOpacity
                  style={styles.stepImageContainer}
                  onPress={() => showImagePicker("step", index)}
                  disabled={isUploading}
                >
                  {step.image ? (
                    <View style={styles.stepImageWrapper}>
                      <Image
                        source={{ uri: step.image }}
                        style={styles.stepImage}
                        resizeMode="cover"
                      />
                      <IconButton
                        icon="pencil"
                        size={20}
                        style={styles.editImageIcon}
                        iconColor={theme.colors.onPrimary}
                        containerColor={theme.colors.primary}
                      />
                    </View>
                  ) : (
                    <View style={styles.stepImagePlaceholder}>
                      <IconButton icon="camera-plus" size={24} />
                      <Text style={styles.stepImageText}>画像を追加</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ))}

            {steps.length === 0 && (
              <Text style={styles.placeholderText}>手順を追加してください</Text>
            )}
          </View>
        </Surface>

        {/* 下部の余白（保存ボタンと重ならないように） */}
        <View style={{ height: 100 + insets.bottom }} />
      </ScrollView>

      {/* タグ追加ダイアログ */}
      <Portal>
        <Dialog
          visible={tagDialogVisible}
          onDismiss={() => setTagDialogVisible(false)}
        >
          <Dialog.Title>タグを追加</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="タグ名"
              value={newTag}
              onChangeText={setNewTag}
              style={{ marginTop: 8 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTagDialogVisible(false)}>
              キャンセル
            </Button>
            <Button onPress={addTag}>追加</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 画像選択ダイアログ */}
      <Portal>
        <Dialog
          visible={imageDialogVisible}
          onDismiss={() => setImageDialogVisible(false)}
        >
          <Dialog.Title>画像を選択</Dialog.Title>
          <Dialog.Content>
            <Button
              icon="image"
              mode="outlined"
              onPress={handlePickImage}
              style={styles.imageButton}
            >
              ギャラリーから選択
            </Button>
            <Button
              icon="camera"
              mode="outlined"
              onPress={handleTakePhoto}
              style={styles.imageButton}
            >
              カメラで撮影
            </Button>
            {(currentImageTarget?.type === "main" && mainImage) ||
            (currentImageTarget?.type === "step" &&
              typeof currentImageTarget?.index === "number" &&
              steps[currentImageTarget.index]?.image) ? (
              <Button
                icon="delete"
                mode="outlined"
                onPress={handleRemoveImage}
                style={[styles.imageButton, styles.deleteButton]}
                textColor={theme.colors.error}
              >
                画像を削除
              </Button>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setImageDialogVisible(false)}>
              キャンセル
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 保存ボタン */}
      <Button
        mode="contained"
        onPress={saveRecipe}
        loading={isSaving}
        disabled={isSaving || isUploading}
        style={[styles.saveButton, { bottom: 24 + insets.bottom }]}
        contentStyle={styles.saveButtonContent}
        labelStyle={styles.saveButtonLabel}
      >
        {isSaving ? "保存中..." : "レシピを保存"}
      </Button>

      {/* スナックバー */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  scrollView: {
    flex: 1,
  },
  formSection: {
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  input: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInput: {
    width: "48%",
  },
  tagsSection: {
    marginVertical: 16,
  },
  publicSection: {
    marginVertical: 16,
  },
  publicToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    margin: 4,
  },
  ingredientsSection: {
    marginVertical: 16,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  stepsSection: {
    marginVertical: 16,
  },
  stepContainer: {
    marginBottom: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 8,
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  placeholderText: {
    fontStyle: "italic",
    color: "#888",
    marginVertical: 8,
  },
  button: {
    marginTop: 16,
  },
  saveButton: {
    position: "absolute",
    left: "10%",
    right: "10%",
    width: "80%",
    borderRadius: 30,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  saveButtonContent: {
    height: 50,
  },
  saveButtonLabel: {
    fontSize: 18,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  mainImageSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  mainImageContainer: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0e0e0",
    marginBottom: 16,
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  mainImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  stepImageContainer: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginTop: 8,
  },
  stepImageWrapper: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  stepImage: {
    width: "100%",
    height: "100%",
  },
  editImageIcon: {
    position: "absolute",
    bottom: 8,
    right: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  stepImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  stepImageText: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
  },
  imageButton: {
    marginVertical: 8,
  },
  deleteButton: {
    borderColor: "#f44336",
    marginTop: 16,
  },
});
