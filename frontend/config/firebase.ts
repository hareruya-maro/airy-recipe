import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Firebaseの設定
// 注意: 実際の値はプロジェクト設定から取得してください
const firebaseConfig = {
  apiKey: "AIzaSyAFL6ZyY-5h-S5II-Vyp0dg6i3ob8F9eE0",
  authDomain: "airy-recipe.firebaseapp.com",
  projectId: "airy-recipe",
  storageBucket: "airy-recipe.firebasestorage.app",
  messagingSenderId: "240230020859",
  appId: "1:240230020859:web:57c465a843e135437be25e",
};

// Firebaseアプリを初期化
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const functions = getFunctions(app);
const storage = getStorage(app);

// Firestoreを初期化
const db = getFirestore(app, "(default)");
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// 匿名サインイン関数
const signInAnonymousUser = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error("匿名認証エラー:", error);
    throw error;
  }
};

// サインアウト関数
const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("サインアウトエラー:", error);
    throw error;
  }
};

// Firebase Functions APIを呼び出すヘルパー関数
const callFunction = async <T = any, R = any>(
  functionName: string,
  data: T
): Promise<R> => {
  try {
    const functionRef = httpsCallable<T, R>(functions, functionName);
    const result = await functionRef(data);
    return result.data;
  } catch (error) {
    console.error(`Firebase Function '${functionName}' 呼び出しエラー:`, error);
    throw error;
  }
};

export {
  app,
  auth,
  callFunction,
  collection,
  db,
  doc,
  functions,
  getDoc,
  getDocs,
  httpsCallable,
  onAuthStateChanged,
  query,
  signInAnonymousUser,
  signOutUser,
  storage,
  where,
};
