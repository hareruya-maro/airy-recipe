import { onAuthStateChanged, User } from "firebase/auth";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth, signInAnonymousUser, signOutUser } from "../config/firebase";

// 認証コンテキストの型定義
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: () => Promise<User | null>;
  logout: () => Promise<void>;
}

// デフォルト値を持つコンテキスト作成
const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  signIn: async () => null,
  logout: async () => {},
});

// コンテキストプロバイダーのProps型定義
interface AuthProviderProps {
  children: ReactNode;
}

// 認証プロバイダーコンポーネント
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 匿名認証
  const signIn = async () => {
    try {
      const user = await signInAnonymousUser();
      return user;
    } catch (error) {
      console.error("匿名認証エラー:", error);
      throw error;
    }
  };

  // ログアウト
  const logout = async () => {
    await signOutUser();
  };

  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // クリーンアップ関数
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    signIn,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// カスタムフック - 認証コンテキストを使用しやすくするため
export const useAuth = () => {
  return useContext(AuthContext);
};
