import { Image } from "expo-image";
import React from "react";
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { IconButton } from "react-native-paper";

type ImageViewerModalProps = {
  imageUri: string;
  isVisible: boolean;
  onClose: () => void;
};

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  imageUri,
  isVisible,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.closeArea} onPress={onClose}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.image,
                { width: width * 0.9, height: height * 0.7 },
              ]}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
        <IconButton
          icon="close"
          size={30}
          iconColor="white"
          onPress={onClose}
          style={styles.closeButton}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeArea: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    borderRadius: 8,
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
});
