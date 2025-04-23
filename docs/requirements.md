# レシピアプリ要件定義

## 1. アプリ概要

### アプリ名（仮）

AIry Recipe

### コンセプト

音声と LLM で料理体験を革新する、ハンズフリー・インタラクティブレシピアプリ

### ターゲットユーザー

- 料理中に手が離せない、スマートフォンを汚したくないと感じている人
- レシピの特定のステップだけを素早く確認したい人
- 料理初心者で、手順や用語について質問しながら進めたい人
- 新しい料理体験を楽しみたい人

### 利用シーン

- キッチンでスマートフォンやタブレットを設置し、音声でレシピを確認しながら調理する。
- 調理中に不明点があれば、アプリに話しかけて解決する。

## 2. 技術スタック概要

- **フロントエンド:** React Native + Expo
- **バックエンド:** Google Cloud
  - **API & ビジネスロジック:** Firebase Functions (Node.js or Python)
  - **LLM:** Vertex AI (Gemini API など)
  - **データベース (将来):** Firestore
  - **認証 (将来):** Firebase Authentication
- **アーキテクチャ:** Expo アプリ <-> Firebase Functions (API Gateway) <-> Vertex AI / Firestore

## 3. MVP：最小限実装の要件（ハッカソン向け）

ハッカソンでは、コアとなる体験（音声操作、LLM 連携）をデモンストレーションできることに注力します。

### 3.1. 機能要件

- **レシピ表示機能:**
  - `[RN/Expo]` サンプルレシピデータ（JSON 形式など）をアプリ内にバンドルするか、Firestore の固定コレクションから取得。
  - `[RN/Expo]` 材料リスト、手順リストを表示する React Native コンポーネントを作成。
  - `[RN/Expo]` 「料理中モード」用の画面コンポーネントを作成。大きなフォント、シンプルなレイアウト。状態管理（例: Context API, Zustand）で現在のステップ番号などを管理。
- **基本的な音声操作機能:**
  - `[RN/Expo]` Expo の `expo-av` や `expo-speech`、またはサードパーティの音声認識ライブラリ (例: `react-native-voice`) を利用してマイクからの音声入力を受け付け、テキストに変換。
  - `[RN/Expo]` 音声認識の開始/停止を制御する UI（マイクボタンなど）を実装。
  - `[RN/Expo]` 認識されたテキストを Firebase Functions のエンドポイントに送信。
  - `[Firebase Functions]` 受け取ったテキストが定義済みの基本コマンド（「次へ」「戻る」など）に合致するか判定するロジックを実装。
  - `[Firebase Functions]` 判定結果（実行すべきアクション）を JSON 形式で Expo アプリに返す (例: `{ "action": "next_step" }`, `{ "action": "show_ingredients" }`)。
  - `[RN/Expo]` Firebase Functions からのレスポンスに応じて、アプリの状態（表示ステップなど）を更新し、画面を再描画。
- **LLM 連携（基本レベル）:**
  - `[Firebase Functions]` 受け取ったテキストが基本コマンドでない場合、Vertex AI の API（例: Gemini API）を呼び出す準備をする。
  - `[Firebase Functions]` 自然言語操作の解釈: 事前に定義したプロンプトと共に、認識されたテキストを Vertex AI に送信し、基本コマンドのいずれかに該当するか、または質疑応答かを判断させる (例: Function Calling 機能の活用検討)。Vertex AI からの結果に基づき、実行すべきアクションを特定。
  - `[Firebase Functions]` 質疑応答: 質問と判断された場合、適切なプロンプトと共に Vertex AI に再度送信し、回答を生成させる。
  - `[Firebase Functions]` Vertex AI からの応答（アクション指示 or 生成された回答テキスト）を Expo アプリに返す。
  - `[RN/Expo]` LLM からの回答テキストを受け取り、モーダルウィンドウや専用エリアに表示するコンポーネントを実装。

### 3.2. 非機能要件

- **プラットフォーム:** Expo Go または Development Build を用いて iOS または Android のどちらかで動作確認。
- **UI/UX:**
  - React Native の標準コンポーネントまたは UI ライブラリ (例: React Native Elements, React Native Paper) を使用。
  - 視認性を考慮したスタイルシート (StyleSheet) を定義。
  - 音声入力中であることが視覚的にわかるフィードバック。
- **パフォーマンス:**
  - `[Firebase Functions]` 関数のコールドスタート時間を考慮。必要に応じて最小インスタンス設定を検討（ハッカソン期間では不要な可能性が高い）。
  - `[Vertex AI]` API の応答時間を確認。デモに耐えうるか。
  - `[RN/Expo]` 音声認識の開始/終了、API 通信中のローディング表示などを実装し、体感速度を向上。
- **インフラ:**
  - Firebase プロジェクトを作成し、Functions と (必要なら) Firestore を設定。
  - Vertex AI API を有効化し、認証情報 (サービスアカウントキー or Application Default Credentials) を Functions 環境に設定。
- **開発環境:** Expo CLI, Firebase CLI, Google Cloud SDK をセットアップ。

### 3.3. ハッカソンでの技術的ゴール

- Expo アプリから音声入力を行い、Firebase Functions 経由で基本的な操作コマンドまたは Vertex AI による自然言語解釈/質疑応答が実行され、結果が Expo アプリに反映されるエンドツーエンドのデモ。

## 4. 追加機能：ハッカソン後の拡張案

MVP の反応を見ながら、以下の機能を追加していくことを検討します。

### 4.1. 機能要件

- **レシピ機能拡充:**
  - `[Firestore]` レシピデータを格納するためのスキーマ設計とデータ投入。
  - `[Firebase Functions]` Firestore からレシピを検索・取得する API エンドポイントを実装。
  - `[RN/Expo]` 検索 UI、レシピ一覧表示、詳細表示画面を実装。
  - `[Firebase Auth]` Firebase Authentication を用いたユーザー認証機能の実装。
  - `[Firestore]` ユーザーごとのお気に入りデータなどを格納。
  - ユーザーによるレシピ投稿・共有機能
- **音声操作・対話機能強化:**
  - `[RN/Expo]` タイマー機能の実装 (Expo のバックグラウンド実行機能やプッシュ通知 (FCM) の活用検討)。
  - 買い物リスト作成支援（レシピから自動生成、音声での追加・削除）
  - `[Firebase Functions / Vertex AI]` より複雑な対話シナリオに対応するためのプロンプトエンジニアリング。Vertex AI の Function Calling や LangChain/LlamaIndex のようなフレームワークの導入検討。
  - LLM による高度な質疑応答（代替材料提案、味調整相談など）
  - `[RN/Expo / GCP]` LLM の回答を音声で読み上げる機能（Expo の `expo-speech` または Google Cloud Text-to-Speech API + Firebase Functions 経由）。
  - LLM との対話履歴の保持
- **パーソナライズ:**
  - `[Firestore]` ユーザープロファイル（アレルギー、好み）を保存。
  - `[Firebase Functions / Vertex AI]` プロファイル情報を考慮したレシピフィルタリングや提案ロジック。
  - 調理スキルレベルに合わせた表示調整
- **その他:**
  - 調理器具や残っている食材からのレシピ提案（LLM 活用）
  - 複数デバイス連携

### 4.2. 非機能要件

- **プラットフォーム:** Expo Prebuild や EAS Build を用いてネイティブプロジェクトを生成し、iOS/Android 両対応、タブレットへの最適化。
- **オフライン対応:**
  - `[RN/Expo]` Expo FileSystem API や AsyncStorage, WatermelonDB/Realm などを利用してレシピデータや設定をローカルにキャッシュ。
- **パフォーマンス:**
  - `[Firestore]` 適切なインデックス設計。
  - `[Firebase Functions]` 関数の最適化、キャッシュ戦略。
  - `[RN/Expo]` パフォーマンスモニタリング (React Native Performance Monitor, Sentry など) の導入。バンドルサイズの最適化。
- **CI/CD:** GitHub Actions や Cloud Build を用いたテスト、ビルド、デプロイの自動化 (EAS Update 含む)。
- **セキュリティ:** Firebase App Check の導入、Functions のアクセス制御、API キー管理。
- **アクセシビリティ:** 色覚特性や視覚障がいを持つユーザーへの配慮。
- **多言語対応**

## 5. データモデル設計

### 5.1. レシピデータモデル

以下は Firestore に保存するレシピのデータ構造です：

- **Recipe（レシピ）**

  - `id`: string - レシピの一意識別子
  - `title`: string - レシピのタイトル
  - `description`: string - レシピの簡単な説明
  - `imageUrl`: string - レシピのメイン画像 URL
  - `servings`: number - 何人前か
  - `prepTime`: number - 準備時間（分）
  - `cookTime`: number - 調理時間（分）
  - `totalTime`: number - 合計時間（分）
  - `difficulty`: string - 難易度（"beginner", "intermediate", "advanced"）
  - `cuisine`: string - 料理のジャンル（和食、洋食など）
  - `tags`: array<string> - 検索用のタグ（「朝食」「パーティー」「ベジタリアン」など）
  - `createdAt`: timestamp - 作成日時
  - `updatedAt`: timestamp - 更新日時
  - `createdBy`: string - 作成者の UID（ユーザー投稿の場合）または "system"（システム共通レシピの場合）
  - `isPublic`: boolean - 公開状態
  - `isSystemRecipe`: boolean - システム共通レシピかどうかのフラグ

- **Ingredient（材料）**

  - `name`: string - 材料名
  - `quantity`: number - 数量
  - `unit`: string - 単位（g、ml、個など）
  - `note`: string? - 追加情報（任意）

- **Step（手順）**

  - `order`: number - 手順の順番
  - `instruction`: string - 手順の説明
  - `imageUrl`: string? - 手順の画像 URL（任意）
  - `tip`: string? - その手順に関するヒント（任意）

- **ユーザー関連データ**
  - `favorites`: array<string> - お気に入りレシピの ID
  - `skillLevel`: string - 料理スキルレベル（初心者、中級者、上級者）
  - `preferences`: object - 好み設定（アレルギー情報など）

### 5.2. Firestore コレクション設計

Firestore では以下のようなコレクション・ドキュメント構造を想定します：

```
firestore/
  recipes/                     # 全レシピのコレクション（共通レシピとユーザー個別レシピ両方を含む）
    {recipeId}/                # 個別のレシピドキュメント
      ingredients/             # そのレシピの材料サブコレクション
        {ingredientId}/        # 個別の材料ドキュメント
      steps/                   # そのレシピの手順サブコレクション
        {stepId}/              # 個別の手順ドキュメント

  users/                       # ユーザーのコレクション
    {userId}/                  # 個別のユーザードキュメント
      favorites/               # お気に入りレシピのサブコレクション
        {favoriteId}/          # お気に入りレシピの参照
```

### 5.3. ユーザー共通レシピとユーザー個別レシピの管理

アプリでは「システム共通レシピ」と「ユーザー個別レシピ」の 2 種類のレシピを扱いますが、単一の `recipes` コレクションで管理します：

1. **システム共通レシピ**

   - `recipes` コレクションに格納され、`isSystemRecipe = true` のフラグを持つ
   - `createdBy = "system"` を持つ
   - アプリ運営側が提供する基本レシピ
   - ユーザーは編集できず、お気に入り登録またはコピーのみ可能

2. **ユーザー個別レシピ**

   - ユーザーが個別に作成または追加したレシピ
   - `recipes` コレクションに格納され、`createdBy` フィールドに作成者のユーザー ID を持つ
   - `isSystemRecipe = false` のフラグを持つ
   - 作成者のみが編集可能
   - 必要に応じて公開設定（`isPublic`）を変更可能

3. **レシピの管理方法**
   - ユーザーがアプリを利用する際は、`recipes` コレクションからの条件付きクエリで:
     a. システム共通レシピ（`isSystemRecipe = true`）
     b. ユーザー自身が作成したレシピ（`createdBy = currentUserId`）
     c. 他のユーザーが公開しているレシピ（`isPublic = true AND createdBy != currentUserId`）
   - これら 3 種類のレシピをクエリして表示する
   - ユーザーはシステムレシピをベースに自分用にカスタマイズしたレシピを作成可能（コピー機能）
   - コピーされたレシピは新しいドキュメント ID で `recipes` コレクションに保存され、`createdBy` に当該ユーザーの ID と `isSystemRecipe = false` が設定される

### 5.4. クエリの考慮事項

よく使われるクエリパターンと、それをサポートするために必要なインデックス設計の考慮事項：

- レシピの検索（タグ、難易度、調理時間でフィルタリング）
- 人気のレシピ（お気に入り数でソート）
- 最近追加されたレシピ（作成日時でソート）
- ユーザーのお気に入りレシピ一覧
- ジャンル別レシピ一覧
- ユーザーが作成したレシピ一覧（`createdBy = currentUserId`）
- システム共通レシピ一覧（`isSystemRecipe = true`）
- 公開されている他ユーザーのレシピ一覧（`isPublic = true AND createdBy != currentUserId`）

### 5.5. Firestore セキュリティルール

Firestore のセキュリティルールは以下のポリシーに基づいて設計します：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザー認証関数
    function isAuthenticated() {
      return request.auth != null;
    }

    // 現在のユーザーが指定されたユーザーIDと一致するか確認
    function isUser(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // システムレシピかどうかを確認
    function isSystemRecipe() {
      return resource.data.isSystemRecipe == true;
    }

    // レシピの作成者かどうかを確認
    function isRecipeOwner() {
      return isAuthenticated() && resource.data.createdBy == request.auth.uid;
    }

    // レシピがパブリックかどうかを確認
    function isPublicRecipe() {
      return resource.data.isPublic == true;
    }

    // レシピコレクションのルール
    match /recipes/{recipeId} {
      // 読み取りルール：
      // 1. システムレシピはすべてのユーザーが閲覧可能
      // 2. 自分が作成したレシピは閲覧可能
      // 3. パブリックに設定されたレシピは閲覧可能
      allow read: if isAuthenticated() && (
        isSystemRecipe() ||
        isRecipeOwner() ||
        isPublicRecipe()
      );

      // 作成ルール：認証済みユーザーのみレシピ作成可能
      // システムレシピの作成は禁止（サーバーサイドでのみ作成可能）
      allow create: if isAuthenticated() &&
                     request.resource.data.isSystemRecipe == false &&
                     request.resource.data.createdBy == request.auth.uid;

      // 更新ルール：
      // 1. 自分が作成したレシピのみ更新可能
      // 2. システムレシピの更新は禁止（サーバーサイドでのみ更新可能）
      allow update: if isAuthenticated() &&
                      !isSystemRecipe() &&
                      isRecipeOwner();

      // 削除ルール：自分が作成したレシピのみ削除可能
      allow delete: if isAuthenticated() &&
                      !isSystemRecipe() &&
                      isRecipeOwner();

      // レシピの材料サブコレクションのルール
      match /ingredients/{ingredientId} {
        // 読み取りルール：親レシピと同じ権限
        allow read: if isAuthenticated() && (
          isSystemRecipe() ||
          isRecipeOwner() ||
          isPublicRecipe()
        );

        // 作成/更新/削除ルール：親レシピの所有者のみ可能
        allow create, update, delete: if isAuthenticated() &&
                                         !isSystemRecipe() &&
                                         isRecipeOwner();
      }

      // レシピの手順サブコレクションのルール
      match /steps/{stepId} {
        // 読み取りルール：親レシピと同じ権限
        allow read: if isAuthenticated() && (
          isSystemRecipe() ||
          isRecipeOwner() ||
          isPublicRecipe()
        );

        // 作成/更新/削除ルール：親レシピの所有者のみ可能
        allow create, update, delete: if isAuthenticated() &&
                                         !isSystemRecipe() &&
                                         isRecipeOwner();
      }
    }

    // ユーザーコレクションのルール
    match /users/{userId} {
      // 自分のユーザードキュメントのみ読み書き可能
      allow read, write: if isUser(userId);

      // お気に入りサブコレクションのルール
      match /favorites/{favoriteId} {
        allow read, write: if isUser(userId);
      }
    }
  }
}
```

このセキュリティルールでは以下のポリシーを実装しています：

1. **レシピへのアクセス制御**:

   - システム共通レシピはすべての認証済みユーザーが閲覧可能
   - ユーザー自身が作成したレシピは閲覧・編集・削除可能
   - 他のユーザーの公開レシピは閲覧のみ可能

2. **システムレシピの保護**:

   - システムレシピはクライアント側からの更新や削除ができない
   - システムレシピの作成・更新・削除はサーバーサイド（管理者）のみ可能

3. **ユーザーデータの保護**:

   - ユーザー情報やお気に入りリストは本人のみアクセス可能

4. **整合性の確保**:
   - レシピ作成時のユーザー ID は認証情報と一致している必要がある
   - サブコレクション（材料・手順）は親レシピの権限を継承

これらのルールにより、データの保護と適切なアクセス制御が保証されます。

## 6. 開発上の考慮事項

- **API キー/認証情報管理:** Google Cloud のサービスアカウントキーや Vertex AI API キーを安全に管理する (Secret Manager の利用推奨)。Firebase Functions の環境変数に設定する。
- **エラーハンドリング:** API 通信エラー、音声認識エラー、LLM エラーなど、各段階でのエラーハンドリングとユーザーへのフィードバックを丁寧に実装する。
- **コスト管理:** Firebase Functions の実行回数、Vertex AI のトークン使用量など、GCP のコストを意識する。予算アラートを設定する。
- **Expo ライブラリ:** Expo が提供する API と、サードパーティの React Native ライブラリの選定。互換性やメンテナンス状況を確認する。
- **プロンプトエンジニアリング:** LLM に意図した操作や回答をさせるための、プロンプト（指示文）の設計が重要。
