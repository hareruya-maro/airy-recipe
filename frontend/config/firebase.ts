import firebase from "@react-native-firebase/app";
import firebaseAuth from "@react-native-firebase/auth";
import firebaseFirestore from "@react-native-firebase/firestore";
import firebaseFunctions from "@react-native-firebase/functions";
import firebaseStorage from "@react-native-firebase/storage";

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
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// サービスインスタンスを取得
const auth = firebaseAuth();
const db = firebaseFirestore();
const functions = firebaseFunctions();
const storage = firebaseStorage();
const app = firebase.app();

// 匿名サインイン関数
const signInAnonymousUser = async () => {
  try {
    const userCredential = await auth.signInAnonymously();
    return userCredential.user;
  } catch (error) {
    console.error("匿名認証エラー:", error);
    throw error;
  }
};

// サインアウト関数
const signOutUser = async () => {
  try {
    await auth.signOut();
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
    const result = await functions.httpsCallable(functionName)(data);
    return result.data as R;
  } catch (error) {
    console.error(`Firebase Function '${functionName}' 呼び出しエラー:`, error);
    throw error;
  }
};

// 従来のコードとのインターフェース互換性のために、必要な関数をエクスポート
const collection = (collectionPath: string) => db.collection(collectionPath);
const doc = (path: string, ...pathSegments: string[]) => {
  if (pathSegments.length === 0) {
    return db.doc(path);
  }
  return db.collection(path).doc(pathSegments[0]);
};
const query = (collectionRef: any, ...queryConstraints: any[]) => {
  let q = collectionRef;
  queryConstraints.forEach((constraint) => {
    q = q.where(constraint.fieldPath, constraint.op, constraint.value);
  });
  return q;
};
const serverTimestamp = () => firebaseFirestore.FieldValue.serverTimestamp();
const setDoc = async (docRef: any, data: any) => await docRef.set(data);
const updateDoc = async (docRef: any, data: any) => await docRef.update(data);
const deleteDoc = async (docRef: any) => await docRef.delete();
const writeBatch = () => db.batch();
const onAuthStateChanged = (callback: any) => auth.onAuthStateChanged(callback);
const httpsCallable = functions.httpsCallable;

export {
  app,
  auth,
  callFunction,

  // Firestore exports
  collection,
  db,
  deleteDoc,
  doc,
  functions,
  // Functions export
  httpsCallable,

  // Auth exports
  onAuthStateChanged,
  query,
  serverTimestamp,
  setDoc,
  signInAnonymousUser,
  signOutUser,
  storage,
  updateDoc,
  writeBatch,
};
