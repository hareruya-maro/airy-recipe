import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signOut } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Firebaseの設定
// 注: 実際の値は.envファイルや環境変数から取得することをお勧めします
const firebaseConfig = {
  apiKey: "AIzaSyAFL6ZyY-5h-S5II-Vyp0dg6i3ob8F9eE0",
  authDomain: "airy-recipe.firebaseapp.com",
  projectId: "airy-recipe",
  storageBucket: "airy-recipe.firebasestorage.app",
  messagingSenderId: "240230020859",
  appId: "1:240230020859:web:57c465a843e135437be25e",
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// Cloud Functions
const functions = getFunctions(app);

// Cloud Storage
const storage = getStorage(app);

// Firebase Authentication
const auth = getAuth(app);

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

export { app, auth, functions, signInAnonymousUser, signOutUser, storage };
