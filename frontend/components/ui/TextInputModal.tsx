import React, { useRef } from "react";
import { TextInput as RNTextInput, StyleSheet } from "react-native";
import { Button, Dialog, Portal, TextInput } from "react-native-paper";

interface TextInputModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (text: string) => void;
  title?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
}

const TextInputModal: React.FC<TextInputModalProps> = ({
  visible,
  onDismiss,
  onSubmit,
  title = "テキスト入力",
  placeholder = "ここに入力してください",
  submitLabel = "送信",
  cancelLabel = "キャンセル",
}) => {
  const textRef = useRef<string>("");
  // テキスト入力の参照
  const inputRef = useRef<RNTextInput>(null);

  const handleSubmit = () => {
    if (textRef.current?.trim()) {
      onSubmit(textRef.current);
      textRef.current = ""; // テキストを送信した後、テキストをクリア
      inputRef.current?.clear(); // テキスト入力をクリア
    }
  };

  const handleDismiss = () => {
    textRef.current = ""; // モーダルを閉じるときにテキストをクリア
    inputRef.current?.clear(); // テキスト入力をクリア
    onDismiss();
  };

  // キーボードの送信ボタンを押したときの処理
  const handleSubmitEditing = () => {
    if (textRef.current.trim()) {
      handleSubmit();
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            ref={inputRef}
            onChangeText={(text) => (textRef.current = text)}
            placeholder={placeholder}
            autoFocus
            style={styles.textInput}
            multiline
            returnKeyType="done"
            onSubmitEditing={handleSubmitEditing}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleDismiss}>{cancelLabel}</Button>
          <Button onPress={handleSubmit} mode="contained">
            {submitLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  textInput: {
    marginVertical: 8,
  },
});

export default TextInputModal;
