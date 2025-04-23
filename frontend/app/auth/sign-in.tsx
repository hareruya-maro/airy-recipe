import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { useAuth } from "../../contexts/AuthContext";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 匿名認証処理
  const handleSignIn = async () => {
    try {
      setLoading(true);
      await signIn();
      // 認証状態の変更は AuthContext の useEffect で検出され、
      // そこから _layout.tsx の AuthRoute によってリダイレクトされます
    } catch (error: any) {
      Alert.alert("認証エラー", error.message || "認証に失敗しました");
      console.error("認証エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require("../../assets/images/splash-icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText style={styles.title}>AIry Recipe</ThemedText>
        <ThemedText style={styles.subtitle}>
          AIが提案するレシピアプリ
        </ThemedText>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.signInButtonText}>ゲストとして続ける</Text>
        </TouchableOpacity>
      </View>

      <ThemedText style={styles.noteText}>
        プライベートモードでアプリを利用できます。{"\n"}
        データはこのデバイスにのみ保存され、{"\n"}
        他の端末での復元はできません。
      </ThemedText>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 300,
  },
  signInButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "#4A90E2",
    flexDirection: "row",
    justifyContent: "center",
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  noteText: {
    fontSize: 12,
    textAlign: "center",
    opacity: 0.7,
    marginTop: 20,
    paddingHorizontal: 30,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
});
