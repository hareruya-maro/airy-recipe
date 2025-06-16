import "react-native-gesture-handler";

import { useColorScheme } from "@/hooks/useColorScheme";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { setNativeExceptionHandler } from "react-native-exception-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider as PaperProvider } from "react-native-paper";
import "react-native-reanimated";
import { ModelInitializingIndicator } from "../components/ModelInitializingIndicator";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

setNativeExceptionHandler((exceptionString) => {});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// 認証状態に基づいたルーティング処理
function AuthRoute() {
  const { currentUser, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth";

    if (!currentUser && !inAuthGroup) {
      // ユーザーが認証されていない場合、サインイン画面にリダイレクト
      router.replace("/auth/sign-in");
    } else if (currentUser && inAuthGroup) {
      // ユーザーが認証されている場合、メイン画面にリダイレクト
      router.replace("/");
    }
  }, [currentUser, loading, segments]);

  return <></>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PaperProvider>
          <Stack>
            <Stack.Screen
              name="(drawer)"
              options={{
                headerShown: false,
                // ドロワーの場合はアニメーションを変更
                animation: "none",
              }}
            />
            <Stack.Screen name="+not-found" />
            <Stack.Screen
              name="auth/sign-in"
              options={{
                headerShown: false,
                animation: "fade",
              }}
            />
          </Stack>
          <AuthRoute />
          <StatusBar style="auto" />
          {/* モデル初期化中のインジケーターを追加 */}
          <ModelInitializingIndicator />
        </PaperProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
