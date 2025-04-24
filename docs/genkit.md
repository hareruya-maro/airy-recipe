# **Genkit を用いたレシピ画像からの構造化テキスト抽出システムの構築可能性に関する分析**

## **1. はじめに**

### **1.1 Firebase Genkit の概要**

Firebase Genkit は、アプリケーションに AI を活用した機能を構築、テスト、デプロイ、監視するプロセスを合理化するために設計されたオープンソースのフレームワークです 1。開発者中心のコードファーストなアプローチを重視しており 2、開発者が使い慣れたパターンやパラダイムを用いて、洗練された AI 機能をアプリケーションに組み込むことを可能にします 5。Genkit は現在、Node.js/TypeScript 向けに提供されており、Go 言語（ベータ版）および Python（アルファ版）のサポートも進行中です 2。このフレームワークは、プラグイン、テンプレート、シンプルな抽象化を提供することで、AI コンポーネントの統合に伴う複雑さを軽減し、開発者が独自のカスタムロジックやデータと AI モデルを組み合わせて、ビジネスに最適化された AI 機能を構築することを支援します 1。

### **1.2 ユーザーの問いへの対応**

本レポートは、「Genkit を使ってレシピ画像からレシピのテキスト情報（材料、手順など）を読み取る仕組みを作ることは可能か？」というユーザーの問いに対応するものです。具体的には、画像に含まれるレシピ情報を構造化されたテキストデータとして抽出するシステムの実現可能性を Genkit の観点から分析します。

### **1.3 実現可能性の確認**

結論として、Genkit を用いてこのようなシステムを構築することは**十分に可能**です 1。Genkit 自体が画像認識やテキスト抽出を行う AI モデルではありませんが、強力なマルチモーダル AI モデル（画像と言語の両方を理解できるモデル）を統合し、その機能をアプリケーション内で利用するための**オーケストレーション・フレームワーク**として機能します。レシピ画像から情報を抽出するという中核的なタスクは、Genkit に接続された AI モデル（例えば Google の Gemini Vision など）が担いますが、Genkit はそのプロセス全体を管理し、開発者が効率的にシステムを構築・運用できるように支援します。

### **1.4 レポートの構成**

本レポートでは、まず Genkit がマルチモーダル AI タスクの基盤としてどのように機能するかを解説します。次に、Gemini Vision のようなマルチモーダルモデルを Genkit 経由で活用する方法、特にレシピ情報のような構造化データを抽出するための技術に焦点を当てます。さらに、具体的な実装ワークフロー、潜在的な課題とその対処法について詳述し、最後に結論と推奨事項を提示します。

### **1.5 Genkit の役割：フレームワークとしての位置づけ**

Genkit を理解する上で重要なのは、それが AI そのものではなく、AI 機能を構築するための**フレームワーク**であるという点です。Genkit は、AI モデル（特にマルチモーダルモデル）、ベクトルストア、外部ツールといった必要なコンポーネントを、プラグインを通じて接続し、管理するための構造とツールを提供します 1。レシピ画像の解析やテキスト生成といった高度な処理は、Genkit に接続された AI モデルに委任されます。Genkit の価値は、これらの強力なモデルを、開発者が使い慣れた方法で、効率的かつ堅牢にアプリケーションに統合できるようにする点にあります。したがって、このプロジェクトの成功は、Genkit のオーケストレーション能力と、選択されたマルチモーダルモデルの性能の両方に依存します。

## **2. Genkit のマルチモーダル AI タスク基盤**

Genkit は、そのアーキテクチャを通じて、画像を含む多様なデータを扱うマルチモーダル AI タスクの構築を支援します。

### **2.1 Genkit のコアコンセプト**

Genkit の能力を理解するには、いくつかのコアコンセプトを把握することが重要です。

- **プラグイン (Plugins):** Genkit の拡張性の核となるのがプラグインアーキテクチャです。これにより、Google、OpenAI、Anthropic、Ollama など様々なプロバイダーの AI モデル、Pinecone や ChromaDB などのベクトルストア、Firebase サービス、その他のツールやサービスを容易に統合できます 1。公式プラグインとコミュニティプラグインの両方が利用可能であり 10、レシピ画像処理に必要な特定のモデルや機能を組み込む柔軟性を提供します。
- **フロー (Flows):** フローは、エンドツーエンドの AI ロジックを定義するための中心的な構成要素です 1。複数のステップや AI コンポーネントを組み合わせて、特定のワークフローを構築します。フローは型安全であり、ストリーミングをサポートし、ローカルおよびリモートから呼び出し可能です。重要な特徴として、フローは自動的に計測され、詳細なトレース、ログ、メトリクスを提供します 1。これは、非決定的で複雑になりがちな AI インタラクションのデバッグと監視に不可欠です。レシピ抽出タスクでは、画像入力からモデル処理、構造化データ出力までの一連のステップをフローとして定義することになります。
- **統一生成 API (ai.generate):** Genkit は、異なるモデルプロバイダーやモデルタイプ（テキスト生成、画像生成など）に対しても、一貫した API (ai.generate) を提供します 2。これにより、開発者はモデル固有の API 詳細を意識することなく、テキスト、構造化データ、メディア（画像など）の生成をリクエストできます。この抽象化レイヤーは、必要に応じてモデルを切り替える際の作業を大幅に簡略化します。

### **2.2 ネイティブなマルチモーダルコンテンツ処理**

Genkit は、テキスト、画像、その他のデータ形式を組み合わせたマルチモーダルな入力をネイティブにサポートするように設計されています 1。これは、ユーザーが提示したレシピ画像抽出タスクにとって基本的な要件です。開発者は、画像データ（URL や Base64 エンコードされたデータなど）を、テキストによる指示（例：「この画像からレシピ情報を抽出してください」）とともに、単一のプロンプトとして AI モデルに渡すことができます。

Genkit のドキュメントやサンプルでは、ai.generate 呼び出しの prompt 配列内に、{ media: { url: imageUrl } }や{ media: { contentType: 'image/png', url: base64DataUrl } }といった形式で画像データを含める方法が示されています 14。フレームワークがこの共通フォーマットを提供するため、開発者は画像データをモデルに渡すためのカスタム処理を実装する必要がありません。

このネイティブなマルチモーダルサポートは、Genkit の柔軟なプラグインシステムと組み合わさることで、その真価を発揮します。プラグインを通じて強力なマルチモーダルモデル（Gemini Vision など）に接続し、Genkit が提供する統一 API とフロー構造を利用して、画像を含む多様なデータタイプを入力として受け付け、処理するアプリケーションを構築できるのです 1。これにより、開発者はマルチモーダルデータの扱いの複雑さから解放され、アプリケーションのコアロジックに集中できます。

## **3. Genkit 経由でのマルチモーダルモデル（Gemini Vision）の活用**

Genkit のフレームワークは、Gemini Vision のような高度なマルチモーダル AI モデルの能力を、開発者が容易に利用できるように設計されています。

### **3.1 プラグインによるモデル接続**

Genkit で外部の AI モデルを利用するには、対応するプラグインを使用します。例えば、Google の Gemini モデルを利用する場合、Gemini API に直接アクセスするための@genkit-ai/googleai プラグインや、Google Cloud Vertex AI 経由で Gemini や Imagen などのモデルにアクセスするための@genkit-ai/vertexai プラグインがあります 7。

これらのプラグインは、API キーの設定や認証、モデル固有のパラメータ設定といった接続の詳細を抽象化します。開発者は、Genkit の初期化時にプラグインを指定し、必要に応じて API キーやプロジェクト ID などの設定を行うだけで、モデルを利用する準備が整います。

以下は、@genkit-ai/googleai プラグインを使用して Gemini Flash モデルをデフォルトとして設定する簡単な例です 8:

TypeScript

```ts
import { gemini15Flash, googleAI } from '@genkit-ai/googleai';
import { genkit } from 'genkit';

// Genkitインスタンスを設定し、Google AIプラグインを追加
const ai = genkit({
  plugins:,
  model: gemini15Flash, // デフォルトで使用するモデルを指定
});

async function main() {
  const { text } = await ai.generate({
    prompt: 'Firebase Genkitについて教えてください。',
  });
  console.log(text);
}

main();
```

Google AI Studio から取得できる API キーを使用する@genkit-ai/googleai プラグインは、無料枠もあり、手軽に始められる方法として推奨されます 18。一方、@genkit-ai/vertexai プラグインは、Google Cloud プロジェクトとの連携が必要で、課金設定が必要になる場合がありますが 9、Vertex AI の他のサービス（例えば、ベクトル検索や本番環境向けの監視機能）との統合が容易になるという利点があります 7。どちらを選択するかは、プロジェクトの要件、予算、既存のインフラストラクチャによって決定されるべきです。

### **3.2 Gemini Pro Vision の能力**

レシピ画像からの情報抽出において、Gemini Pro Vision のようなモデルは非常に強力な選択肢となります。このモデルは、テキストと画像を同時に理解し、それらについて推論する能力を持っています 19。

- **画像理解:** 画像の内容を説明したり、画像に関する質問に答えたり、特定のオブジェクトを認識したりできます 19。これにより、提示された画像がレシピであることを認識し、その内容を把握する基盤となります。
- **OCR 的なテキスト抽出:** Gemini Vision は、画像からテキストを抽出する能力に長けています。これは単なる文字認識（OCR）を超え、画像の文脈を理解した上での抽出が可能です 19。特に、レシピのような特定の構造を持つ文書に対して有効です。
- **複雑なレイアウトの処理:** レシピによく見られる表形式（材料リストなど）、複数カラム、リスト、埋め込みテキストといった複雑なレイアウトや多様なフォーマットを理解し、適切に情報を抽出する能力があります 22。これは、従来の OCR 技術がしばしば苦戦する点です 28。
- **手書き文字認識:** レシピ画像に手書きのメモが含まれている場合でも、Gemini Vision はある程度認識できます 22。ただし、非常に崩れた文字や筆記体などは、依然として課題となる可能性があります 29。
- **構造化出力生成:** 適切に指示（プロンプト）を与えれば、抽出した情報を JSON のような特定の構造化フォーマットで出力する能力があります 19。この能力を Genkit が活用することで、アプリケーションで扱いやすいデータ形式を得ることができます。

Genkit は、これらの Gemini Vision の高度な能力を、開発者が容易に利用できるようにする**架け橋**として機能します。Genkit の統一 API とプラグインシステムを通じて 1、開発者は複雑なコンピュータビジョン技術や OCR パイプラインの管理について深く知らなくても、最先端の Vision Language Model (VLM) の恩恵を受けることができます。これにより、従来の OCR ツールでは困難だった、複雑なレイアウトや手書き文字を含むレシピ画像からの情報抽出タスクに対して、よりシンプルで効果的な開発プロセスが期待できます。

## **4. Genkit による構造化レシピデータの抽出**

レシピ画像から単にテキストを抽出するだけでなく、それを「タイトル」「材料リスト」「手順」といった構造化されたデータとして取得することが、アプリケーション開発においてはしばしば求められます。Genkit はこの要求に応えるための強力な機能を提供します。

### **4.1 Genkit の構造化出力機能**

Genkit の重要な機能の一つが、AI モデルからの出力を、事前に定義されたスキーマに準拠した、厳密に型付けされた構造化データ（通常は JSON 形式）として生成させる能力です 1。

このプロセスは以下のように機能します 14:

1. **スキーマ定義:** 開発者は、Zod のようなスキーマ定義ライブラリを使用して、期待する出力データの構造（フィールド名、データ型など）を定義します 9。
2. **プロンプト拡張:** ai.generate 呼び出し時にこのスキーマを指定すると、Genkit は内部的にプロンプトを拡張し、モデルに対して指定されたスキーマに従って応答を生成するように指示します。この拡張には、単にフォーマットを指定するだけでなく、どの情報を抽出・生成すべきか（例：レシピ名、材料リスト、手順など）をモデルに伝える役割も含まれます。
3. **モデル生成:** スキーマ情報を考慮して、モデルは JSON 形式（または指定された MIME タイプ）で応答を生成しようとします。
4. **解析と検証:** Genkit はモデルからの応答を受け取り、それを JavaScript オブジェクト（または指定された型）に解析します。そして、そのオブジェクトが提供されたスキーマに準拠しているかを検証します。
5. **結果返却:** 検証に成功した場合、型付けされた構造化オブジェクトが ai.generate の output として返されます。検証に失敗した場合はエラーがスローされます。

この機能により、開発者はモデルからの自由形式のテキスト出力を手動で解析し、検証するという煩雑でエラーが発生しやすい作業から解放され、アプリケーションで直接利用可能な、予測可能で信頼性の高いデータを取得できます。

### **4.2 レシピスキーマの定義**

レシピ情報を構造化するために、Zod を使用して具体的なスキーマを定義します。以下に例を示します。

TypeScript

```ts
import { z } from 'zod';

// 材料のスキーマ
const IngredientSchema = z.object({
  name: z.string().describe("材料の名前 (例: '薄力粉', '卵')"),
  quantity: z.string().describe("材料の分量 (例: '100', '大さじ2', '少々')"),
  unit: z.string().optional().describe("材料の単位 (例: 'g', 'ml', '個')。単位がない場合は省略可。"),
});

// レシピ全体のスキーマ
const RecipeSchema = z.object({
  title: z.string().describe("レシピのタイトル"),
  description: z.string().optional().describe("レシピの簡単な説明（任意）"),
  ingredients: z.array(IngredientSchema).describe("材料のリスト。各材料には名前、分量、単位（任意）を含める"),
  instructions: z.array(z.string()).describe("調理手順のリスト。各ステップを文字列として配列に格納する"),
  prepTime: z.string().optional().describe("準備時間（任意、例: '15分'）"),
  cookTime: z.string().optional().describe("調理時間（任意、例: '30分'）"),
});

// 型定義 (TypeScriptで使用する場合)
type Recipe = z.infer<typeof RecipeSchema>;
```

**表 1: レシピ用 Zod スキーマ例の解説**

| フィールド名         | 型                        | 説明                 | Zod .describe() の役割                                       |
| :------------------- | :------------------------ | :------------------- | :----------------------------------------------------------- |
| title                | string                    | レシピのタイトル     | モデルに「レシピのタイトル」を抽出するよう指示               |
| description          | string (optional)         | レシピの説明（任意） | モデルに任意で「レシピの簡単な説明」を抽出するよう指示       |
| ingredients          | array of IngredientSchema | 材料リスト           | モデルに材料リストを抽出し、各要素を指定の形式にするよう指示 |
| ingredients.name     | string                    | 材料名               | モデルに各材料の「材料の名前」を抽出するよう指示             |
| ingredients.quantity | string                    | 材料の分量           | モデルに各材料の「材料の分量」を抽出するよう指示             |
| ingredients.unit     | string (optional)         | 材料の単位（任意）   | モデルに任意で各材料の「材料の単位」を抽出するよう指示       |
| instructions         | array of string           | 調理手順リスト       | モデルに調理手順をステップごとの文字列リストとして抽出指示   |
| prepTime             | string (optional)         | 準備時間（任意）     | モデルに任意で「準備時間」を抽出するよう指示                 |
| cookTime             | string (optional)         | 調理時間（任意）     | モデルに任意で「調理時間」を抽出するよう指示                 |

このスキーマ定義は、単なる型チェックのためだけではありません。z.describe() メソッドを使用して各フィールドに説明を追加することが重要です 15。これらの説明は、Genkit がプロンプトを拡張する際に利用され、AI モデルが各フィールドにどのような情報を抽出すべきかをより正確に理解するのに役立ちます。明確で詳細なスキーマ定義（特にフィールドの説明）は、モデルが指示に従い、期待通りの構造化出力を生成する能力に直接影響します 14。

### **4.3 構造化抽出のためのプロンプティング**

スキーマを定義したら、ai.generate 呼び出し時に画像入力とテキストプロンプトを組み合わせ、定義したスキーマに基づいて情報を抽出するようにモデルに指示します。

以下は、概念的なプロンプトと ai.generate 呼び出しの例です。

TypeScript

```ts
import { gemini15Flash } from '@genkit-ai/googleai'; // または他の適切なモデル
import { RecipeSchema } from './recipeSchema'; // 上記で定義したスキーマをインポート

async function extractRecipeFromImage(imageUrl: string) {
  try {
    const { output } = await ai.generate({
      model: gemini15Flash, // または 'vertexai/gemini-1.5-pro' など
      prompt: [
        { media: { url: imageUrl } }, // 画像入力
        { text: "この画像からレシピ情報を抽出してください。タイトル、材料（名前、分量、単位を含む）、および手順のステップを抽出してください。" } // テキスト指示
      ],
      output: {
        schema: RecipeSchema, // 定義したZodスキーマを指定
        format: 'json', // 出力形式を明示的に指定 (通常はスキーマから推測される)
      },
      // 必要に応じて温度などの設定を追加
      // config: { temperature: 0.7 }
    });

    // outputはRecipeSchemaに準拠した型付けされたオブジェクト
    if (output) {
      console.log("抽出されたレシピ:", output);
      // アプリケーションロジックでoutputを使用
      return output as Recipe; // 型アサーション
    } else {
      console.error("構造化された出力が得られませんでした。");
      return null;
    }

  } catch (error) {
    console.error("レシピ抽出中にエラーが発生しました:", error);
    // エラーハンドリング (例: リトライ、デフォルト値の使用など)
    return null;
  }
}
```

この例では、prompt 配列に画像 (media) とテキスト指示 (text) の両方を含めています。output.schema に RecipeSchema を指定することで、Genkit とモデルに期待する出力構造を伝えます 14。Gemini のようなモデルは、画像の内容（レシピのテキストやレイアウト）とテキストによる指示（スキーマに基づく抽出要求）の両方を考慮して、RecipeSchema に準拠した JSON データを生成しようと試みます 15。

Genkit の構造化出力メカニズムと Gemini Vision のような強力なマルチモーダルモデルを組み合わせることで、視覚的なレシピ情報を解析し、アプリケーションですぐに利用できる予測可能なデータ形式に変換するという複雑なタスクが、スキーマ定義とプロンプティングという、より管理しやすいプロセスに変わります。これにより、開発者はモデルの生の出力を解析する複雑なロジックを記述する代わりに、必要なデータ（スキーマ）の定義に集中できます。

## **5. Genkit 内での実装ワークフロー**

Genkit を使用してレシピ画像抽出システムを構築する際の、具体的な開発からデプロイまでのワークフローを概説します。

### **5.1 Genkit フローの定義**

中核となるロジックは Genkit のフロー (defineFlow) 内に実装します 4。フローは、入力、出力、および実行される処理ステップを明確に定義します。

TypeScript

```ts
import { defineFlow } from '@genkit-ai/flow';
import { z } from 'zod';
import { ai } from './config'; // Genkitインスタンスをインポート
import { RecipeSchema, Recipe } from './recipeSchema'; // レシピスキーマをインポート

export const extractRecipeFlow = defineFlow(
  {
    name: 'extractRecipeFlow',
    // 入力スキーマ: 画像のURLを受け取る例
    inputSchema: z.object({ imageUrl: z.string().url() }),
    // 出力スキーマ: 抽出されたレシピ情報、またはエラーを示すnull
    outputSchema: RecipeSchema.nullable(),
  },
  async (input): Promise<Recipe | null> => {
    console.log(`レシピ抽出フロー開始: ${input.imageUrl}`);

    try {
      const { output } = await ai.generate({
        model: 'googleai/gemini-1.5-flash', // または他の適切なモデル
        prompt: [
          { media: { url: input.imageUrl } },
          { text: "この画像からレシピ情報を抽出してください。タイトル、材料（名前、分量、単位を含む）、および手順のステップを抽出してください。" }
        ],
        output: {
          schema: RecipeSchema,
          format: 'json',
        },
        // 必要に応じて設定を追加
        // config: { temperature: 0.5 }
      });

      if (output) {
        console.log("レシピ抽出成功:", output.title);
        return output as Recipe;
      } else {
        console.warn("モデルから有効な構造化出力が得られませんでした。");
        return null;
      }
    } catch (error) {
      console.error("レシピ抽出中にエラーが発生しました:", error);
      // ここでより詳細なエラーハンドリングを行う (例: リトライ、特定のエラータイプに応じた処理)
      // 必要であればエラーを再スローするか、nullを返す
      return null;
    }
  }
);
```

このフロー定義では、以下の要素が含まれています。

- **入力スキーマ:** 画像の URL を受け取るシンプルなオブジェクトを定義しています。Base64 エンコードされたデータなど、他の形式も可能です。
- **出力スキーマ:** 成功時には RecipeSchema に準拠したオブジェクト、失敗時には null を返すように定義しています。
- **ロジック:**
  1. 入力から画像 URL を取得します。
  2. 画像 (media) とテキスト指示 (text) を含むマルチモーダルプロンプトを構築します。
  3. ai.generate() を呼び出し、モデル、プロンプト、および出力スキーマ (RecipeSchema) を指定します 14。
  4. 成功すれば検証済みの output オブジェクトを、失敗すれば null を返します。
  5. try-catch ブロックを使用して、生成プロセスやスキーマ検証中に発生する可能性のあるエラーを捕捉し、ログに記録します（詳細は第 6 章の課題で後述）。

### **5.2 Dotprompt によるプロンプト管理**

プロンプト（モデルへの指示テキスト）は、試行錯誤を繰り返しながら改善していくことが多いため、コードから分離して管理するのが効率的です。Genkit は.prompt ファイル形式（Dotprompt）をサポートしており、これを利用することでプロンプトの管理とイテレーションが容易になります 5。

.prompt ファイル内では、使用するモデル、モデル設定（温度など）、入力スキーマ、出力スキーマ、そしてプロンプトのテンプレート自体を定義できます 9。

**例: recipeExtractor.prompt**

YAML

---

model: googleai/gemini-1.5-flash  
config:  
 temperature: 0.5  
input:  
 schema:  
 type: object  
 properties:  
 imageUrl:  
 type: string  
 format: uri  
 description: レシピ画像の URL  
output:  
 schema: RecipeSchema # Zod スキーマを参照 (別途定義が必要)  
 format: json

---

{{#if media}}  
{{#each media}}  
{{media url=../imageUrl}}  
{{/each}}  
{{/if}}  
この画像からレシピ情報を抽出してください。タイトル、材料（名前、分量、単位を含む）、および手順のステップを抽出してください。

_(注: 上記の output.schema: RecipeSchema は概念的な参照です。実際の Dotprompt 実装では、JSON スキーマ形式で直接記述するか、Genkit が Zod スキーマを解決できる仕組みに依存します。)_

コード内では、ai.prompt()を使用してこのファイルをロードし、実行できます 15。

TypeScript

```ts
import { ai } from './config';
import { RecipeSchema } from './recipeSchema'; // スキーマ定義

async function extractRecipeWithPromptFile(imageUrl: string) {
  try {
    // '.prompt'ファイルをロード (ファイル名で参照)
    const recipePrompt = ai.prompt('recipeExtractor');

    // プロンプトを実行し、入力変数 (imageUrl) を渡す
    const { output } = await recipePrompt({ imageUrl });

    // outputはRecipeSchemaで定義された構造を持つはず
    return output;

  } catch (error) {
    console.error("プロンプトファイル実行中にエラー:", error);
    return null;
  }
}
```

Dotprompt を使用することで、プロンプトの変更がコードの変更を必要とせず、バージョン管理も容易になります。

### **5.3 開発とテスト**

Genkit は、ローカルでの開発とテストを効率化するためのツールを提供します。

- **Genkit Developer UI:** コマンドラインで genkit start を実行すると、ブラウザベースの開発 UI が起動します 1。この UI 上で、定義したフロー（例: extractRecipeFlow）を選択し、サンプルのレシピ画像 URL を入力して実行し、結果（抽出された構造化データまたはエラー）をリアルタイムで確認できます。
- **トレース:** Developer UI の重要な機能がトレース表示です 1。フローの各ステップ（モデル呼び出し、スキーマ検証など）の実行時間、入力、出力、メタデータが詳細に表示されます。これにより、どこで問題が発生しているのか、どのステップに時間がかかっているのかを特定し、デバッグプロセスを大幅に効率化できます。構造化出力が失敗した場合、モデルがどのような応答を返し、なぜスキーマ検証に失敗したのかをトレースで確認できます。

### **5.4 デプロイオプション**

開発とテストが完了したら、作成したフローをデプロイしてアプリケーションから利用できるようにします。Genkit は特定のプラットフォームに縛られませんが、特に Google Cloud サービスとの連携が容易です。

- **Cloud Functions for Firebase:** Genkit フローを HTTP エンドポイントとして簡単にデプロイできます 1。Firebase SDK と連携しやすく、認証や App Check などの Firebase 機能も利用可能です 11。
- **Cloud Run:** コンテナ化されたアプリケーションとしてフローをデプロイできます 1。スケーラビリティと柔軟性が高い選択肢です。
- **その他の Node.js 環境:** Express ミドルウェア (@genkit-ai/express) 10 を使用すれば、任意の Node.js ホスティング環境にデプロイすることも可能です 8。

Firebase や Google Cloud にデプロイする場合、@genkit-ai/google-cloud 10 や @genkit-ai/firebase 10 プラグインを利用することで、テレメトリデータ（トレース、メトリクス、ログ）が自動的に Cloud Logging、Cloud Trace、Cloud Monitoring に送信され、Firebase コンソールや Google Cloud コンソールで本番環境でのフローのパフォーマンスやエラー率、トークン消費量などを監視できます 2。

Genkit は、フローの定義からローカルでのテスト・デバッグ、そして本番環境へのデプロイと監視まで、AI 機能開発のライフサイクル全体をサポートする統合的なツールセットを提供します。これにより、開発者は個別のツールを組み合わせる手間を省き、より迅速なイテレーションと高品質な AI 機能の実現に集中できます。

## **6. 潜在的な課題への対処**

Genkit と Gemini Vision を組み合わせることで強力なレシピ抽出システムを構築できますが、画像からの情報抽出には本質的な難しさが伴います。以下に主な課題と、Genkit の機能を活用した対処法を示します。

### **6.1 画像品質の問題**

レシピ画像の品質は、抽出精度に直接影響します。ぼやけ、低解像度、不適切な照明、影、紙のしわ、歪んだ撮影角度などは、最先端のモデルであっても認識を困難にする可能性があります 31。

- **対処法:**
  - **入力品質の確保:** 可能であれば、ユーザーが高品質な画像をアップロードするようにガイドするか、アプリケーション側でキャプチャ品質をチェックする仕組みを設けることが理想的です。
  - **前処理:** Genkit/Gemini に画像を渡す前に、画像補正ライブラリ（例：OpenCV など）を使用して、ノイズ除去、二値化、コントラスト調整、歪み補正などの前処理を行うことを検討します 41。ただし、Gemini Vision 自体もある程度の画像補正能力を持っているため 22、過度な前処理は不要な場合もあります。
  - **モデルの堅牢性:** Gemini Vision は様々な品質の画像に対応できるように設計されていますが 23、限界は存在します。低品質な画像に対しては、抽出精度が低下する可能性があることを念頭に置く必要があります。

### **6.2 レイアウトとフォーマットの多様性**

レシピは、単一カラムのシンプルなリストから、複数カラム、表形式の材料リスト、手順と材料が混在する形式、手書きメモ付きなど、非常に多様なレイアウトとフォーマットで記述されます 41。フォントの種類やサイズも様々です。

- **対処法:**
  - **モデルの能力活用:** Gemini Vision は、複雑なレイアウト（表、複数カラムなど）を理解する能力において、従来の OCR よりも優れています 22。この能力を最大限に活用します。
  - **プロンプトエンジニアリング:** プロンプト内で、特定のレイアウト要素（例：「材料は表形式でリストされています」「手順は番号付きリストです」）に言及し、モデルの解釈を誘導することを試みます。
  - **柔軟なスキーマ設計:** Zod スキーマを設計する際、必須ではないフィールドを optional()にするなど、ある程度の柔軟性を持たせます。例えば、すべてのレシピに準備時間や調理時間が記載されているとは限りません。
  - **反復的なテスト:** 多様なレイアウトのレシピ画像を用いて Genkit Developer UI でテストを行い、モデルがどの程度様々な形式に対応できるかを確認し、必要に応じてプロンプトやスキーマを調整します。

### **6.3 手書き文字の難しさ**

レシピには手書きのメモや修正が含まれることがあります。Gemini Vision は手書き文字認識に対応していますが 22、特に筆記体や判読しにくい文字の認識精度は、印刷された文字に比べて低下する可能性があります 29。一般的な LLM ベースの OCR では、明確な手書き文字で 80-85%程度の精度が期待される場合もありますが、状況によってはそれ以下になることもあります 30。

- **対処法:**
  - **期待値の設定:** 手書き文字が含まれるレシピに対しては、完璧な抽出が常に可能とは限らないことを認識します。
  - **モデル選択:** 手書き認識に特化したモデルやサービスも存在しますが 31、Gemini Vision でもある程度の対応は可能です。精度が重要な場合は、複数のモデルを試すことも考えられます。
  - **後処理/検証:** 抽出結果に手書き部分が含まれる可能性がある場合、ユーザーによる確認・修正ステップを設けることを検討します。

### **6.4 構造化出力の失敗**

AI モデルは確率的に動作するため、常に完璧にスキーマに従った出力を生成するとは限りません 14。以下のような問題が発生する可能性があります。

- **スキーマ不適合:** 生成された JSON が定義した Zod スキーマに違反する（例：必須フィールドがない、データ型が違う）。
- **ハルシネーション（幻覚）:** モデルが存在しない情報を生成したり、誤った情報を抽出したりする 47。
- **抽出漏れ/誤り:** 画像内の特定の情報（例：一部の材料や手順）を見逃したり、誤って解釈したりする。
- **対処法（Genkit 内での対応）:**
  - **Zod Coercion:** スキーマ定義時に z.coerce を使用します 14。例えば、モデルが数値を文字列として生成してしまった場合に、z.coerce.number()が自動的に数値型に変換を試みます。これにより、軽微な型不一致による検証エラーを減らすことができます。
  - **リトライ:** ai.generate 呼び出しが一時的な問題（例：モデルの応答の揺らぎ）で失敗した場合、フロー内でリトライロジック（指数バックオフなど）を実装することを検討します 14。
  - **プロンプトとスキーマの改善:** エラーが発生した場合、プロンプトの指示が不明確だったり、スキーマのフィールド説明が不十分だったりする可能性があります。プロンプトをより具体的にし、スキーマの.describe()を改善することで、モデルの理解を助けます 14。
  - **モデル/パラメータ調整:** Genkit の設定で、異なるモデル（例：Flash から Pro へ）を試したり、temperature のような生成パラメータを調整したりすることで、出力の安定性や精度が変わる可能性があります 5。Developer UI での実験が有効です。
  - **フォールバックと検証:** 高い精度が求められる場合は、抽出結果が一定の基準を満たさない場合に、デフォルト値を返す、ユーザーに確認を促すフラグを立てる、あるいは手動レビューキューに入れるなどのフォールバック戦略を検討します。

### **6.5 コストとパフォーマンス**

Gemini Vision のような強力なマルチモーダルモデルの API 呼び出しにはコストがかかります 1。特に画像処理はテキスト処理よりも多くのリソースを消費する傾向があり、レイテンシ（応答時間）も長くなる可能性があります。

- **対処法:**
  - **監視:** Genkit の監視機能（Firebase/Google Cloud 連携時）を活用し、API 呼び出し回数、トークン消費量、レイテンシを継続的に監視します 2。これにより、コストとパフォーマンスのボトルネックを特定できます。
  - **モデル選択:** コストとパフォーマンスの要件に応じて、適切なモデルバージョンを選択します。例えば、Gemini Flash は Pro よりも高速で低コストですが、複雑なタスクに対する能力は Pro に劣る可能性があります 22。
  - **キャッシュ:** 同じ画像を繰り返し処理する可能性がある場合は、結果をキャッシュすることを検討します（ただし、レシピ抽出のようなユニークな入力が多いユースケースでは効果が限定的かもしれません）。
  - **処理の最適化:** フロー内で不要な API 呼び出しがないか確認し、プロンプトを効率化してトークン数を削減します。

これらの課題は、画像からの情報抽出タスクに共通するものです。Genkit と Gemini Vision はこのタスクを強力に支援しますが、これらの課題を完全に排除するものではありません。成功のためには、Genkit が提供するエラーハンドリング、検証、監視といった機能を活用しつつ、入力品質の管理、慎重なプロンプトエンジニアリング、現実的な期待値の設定、そして継続的なテストと改善が不可欠です。

## **7. 代替アプローチ：外部 OCR のためのツール呼び出し（非推奨）**

Genkit には、AI モデルが外部の関数や API を呼び出すことを可能にする「ツール呼び出し」（Function Calling とも呼ばれる）機能があります 9。理論的には、この機能を使ってレシピ抽出タスクを実装することも考えられます。

### **7.1 ツール呼び出しの概要**

ツール呼び出しでは、開発者は外部 API やカスタム関数を「ツール」として定義します。これには、ツールの名前、説明、期待される入力スキーマ、出力スキーマが含まれます 9。プロンプトと共にこれらのツール定義をモデルに渡すと、モデルはプロンプトの内容を達成するために必要だと判断した場合、特定のツールを呼び出すように要求する応答を返します。アプリケーション（Genkit）はこの要求を受け取り、対応するツール（関数や API 呼び出し）を実行し、その結果を再度モデルに渡して最終的な応答を生成させます 49。

### **7.2 仮説的なシナリオ：外部 OCR ツールの利用**

このメカニズムを利用して、以下のようなフローを構築することが可能です。

1. Genkit フローがレシピ画像を受け取ります。
2. 画像を Gemini モデル（または他の LLM）に渡し、「この画像からテキストを抽出する必要があるか？」といったプロンプトを与えます。同時に、Google Cloud Vision API 24 のような外部の専用 OCR サービスを呼び出すためのツール（例：extractTextWithVisionAPI）を定義して渡します。
3. モデルが OCR ツールの呼び出しが必要だと判断し、ツール呼び出し要求を返します。
4. Genkit が extractTextWithVisionAPI ツールを実行し、外部 OCR サービスに画像を送信してテキストデータを取得します。
5. 取得した OCR テキストを Genkit がモデルに再度渡します。「このテキストからレシピ情報を抽出し、指定されたスキーマに従って構造化してください」といったプロンプトと共に渡します。
6. モデルが OCR テキストを解析し、構造化されたレシピデータを生成します。

### **7.3 なぜこのアプローチが最適ではないか**

上記のシナリオは技術的には可能ですが、今回の「レシピ画像からの構造化テキスト抽出」という特定のタスクにおいては、Gemini Vision のネイティブなマルチモーダル機能を直接利用するアプローチに比べて、いくつかの欠点があります。

- **複雑性の増加:** フローが複数のステップ（モデル判断 → ツール実行 → モデル再実行）に分かれ、管理が複雑になります。エラーハンドリングも各ステップで考慮する必要があります。
- **コンテキストの損失:** 最大の欠点は、**視覚的なコンテキストの損失**です。外部 OCR ツールは通常、画像からテキスト文字列を抽出するだけで、そのテキストが画像のどこに配置されていたか、どのようなレイアウト（表、リストなど）だったかという重要な視覚情報を失います。抽出された生のテキストだけを後続の LLM に渡しても、モデルは元の画像のレイアウトを「見て」理解することができません。レシピのようにレイアウトが意味を持つ文書では、この情報の損失は抽出精度に悪影響を与える可能性があります。
- **効率の低下:** 複数の API 呼び出し（モデル →OCR API→ モデル）が必要となり、レイテンシが増加し、コストも余分にかかる可能性があります。

対照的に、Gemini Vision のようなネイティブなマルチモーダルモデルを Genkit の ai.generate で直接利用する場合、モデルは単一のステップで画像（視覚情報）とテキスト指示（抽出要求）の両方を同時に処理できます 19。これにより、テキストの内容だけでなく、その配置や周辺の視覚要素、文書全体の構造といったコンテキストを総合的に理解し、より正確で質の高い情報抽出と構造化が期待できます。

ツール呼び出しは、LLM が持たない情報（例：リアルタイムの天気情報 9）を取得したり、外部システムでアクション（例：メール送信、カレンダー登録）を実行したりする場合には非常に強力な機能です。しかし、画像の内容を理解しテキストを抽出するというタスク自体がモデルのコア能力（特に Gemini Vision のような VLM）に含まれる場合、そのネイティブ機能を直接活用する方が、シンプルで効率的かつ効果的なアプローチとなります。

## **8. 結論と推奨事項**

### **8.1 実現可能性の再確認**

分析の結果、Firebase Genkit を、Gemini Pro Vision のような強力なマルチモーダル AI モデルと組み合わせて使用することで、レシピ画像から構造化されたテキスト情報（タイトル、材料、手順など）を抽出するシステムを構築することは**十分に実現可能**であると結論付けられます。

### **8.2 Genkit の役割の要約**

Genkit はこの実現において、単なるライブラリ以上の重要な役割を果たします。

- **マルチモーダルサポート:** 画像とテキストを組み合わせた入力をネイティブに処理する基盤を提供します 1。
- **柔軟なモデル統合:** プラグインアーキテクチャにより、Gemini Vision を含む様々な AI モデルを容易に接続・利用できます 9。
- **構造化出力:** Zod などのスキーマ定義と連携し、モデルからの出力を検証済みの構造化データとして取得するプロセスを簡略化します 1。
- **開発者ツール:** ローカルでのテスト、デバッグ、監視を支援する統合的なツール（Developer UI、トレース機能）を提供し、開発サイクルを加速します 1。

Genkit は、複雑な AI 統合のバックエンド処理を抽象化し、開発者がアプリケーションのコアロジック、データ構造の定義、そして最終的なユーザーエクスペリエンスの構築に集中できるようにします。

### **8.3 主な推奨事項**

このシステムの開発を成功させるために、以下の点を推奨します。

1. **モデル選択:**
   - **Gemini Pro Vision** を第一候補とします。その強力なマルチモーダル理解能力、OCR 的なテキスト抽出能力、複雑なレイアウトへの対応力が、レシピ抽出タスクに最適です 22。
   - Google AI プラグイン (@genkit-ai/googleai) または Vertex AI プラグイン (@genkit-ai/vertexai) のどちらを使用するかは、プロジェクトの要件（無料枠、他の GCP サービス連携など）に応じて決定します。
   - コストとパフォーマンスのトレードオフを考慮し、**Gemini Flash** と **Gemini Pro** のどちらがユースケースに適しているか評価します 22。初期段階では Flash から始めるのが手軽かもしれません。
2. **スキーマ設計:**
   - **Zod** を使用して、抽出したいレシピ情報の構造（タイトル、材料リストの形式、手順など）を明確かつ詳細に定義します。
   - 各フィールドには **.describe()** を使用して、モデルがそのフィールドの意味を理解しやすくなるように、具体的な説明を追加します 15。
   - 最初はシンプルなスキーマから始め、テストを通じて必要に応じてフィールドを追加・修正していく反復的なアプローチを取ります。
3. **プロンプトエンジニアリング:**
   - 画像入力と共に、定義したスキーマに基づいて情報を抽出するようにモデルに明確に指示するテキストプロンプトを作成します。
   - プロンプトの管理とイテレーションを容易にするために、**Dotprompt** (.prompt ファイル) の活用を強く推奨します 9。
4. **入力品質:**
   - 可能な限り、**高品質なレシピ画像**を入力として使用することを優先します。低品質な画像は抽出精度を低下させる主要な要因です。
   - 入力画像の品質が大幅に変動する場合は、Genkit に渡す前の基本的な画像前処理ステップの導入を検討します。
5. **エラーハンドリング:**
   - Genkit フロー内に堅牢なエラーハンドリングを実装します。これには、try-catch ブロック、モデルからの予期せぬ応答やスキーマ検証エラーへの対応が含まれます。
   - **Zod Coercion** (z.coerce) を活用して軽微な型エラーを吸収し、必要に応じて**リトライロジック**を組み込むことを検討します 14。
   - 抽出精度が非常に重要な場合は、結果に対する信頼度スコアの推定（モデルがサポートする場合）や、特定の条件下での手動確認フラグの実装も考慮します。
6. **テスト:**
   - **Genkit Developer UI** を最大限に活用し、多様なレシピ画像（異なるレイアウト、フォント、印刷/手書き、品質）を用いてフローを徹底的にテストします 1。
   - トレース情報を分析して、パフォーマンスのボトルネックやエラーの原因を特定し、プロンプト、スキーマ、モデル設定を最適化します。

### **8.4 最終的な考察**

Genkit は、レシピ画像からの情報抽出のような、従来は専門的な知識と複雑なパイプライン構築が必要だった高度な AI 機能を、より多くの開発者が構築できるようにするための強力なツールです。基盤となる AI モデルの複雑さを管理し、構造化された開発・テスト・デプロイのフレームワークを提供することで、開発者は価値あるアプリケーション機能の実現に集中できます。推奨事項に従い、反復的な開発プロセスを採用することで、ユーザーの要求を満たす効果的なシステムを構築できる可能性は非常に高いと言えます。

#### **引用文献**

1. Genkit | Build, test, and deploy powerful AI features - Firebase - Google, 4 月 24, 2025 にアクセス、 [https://firebase.google.com/products/genkit](https://firebase.google.com/products/genkit)
2. Announcing Firebase Genkit 1.0 for Node.js, 4 月 24, 2025 にアクセス、 [https://firebase.blog/posts/2025/02/announcing-genkit/](https://firebase.blog/posts/2025/02/announcing-genkit/)
3. firebase/genkit: An open source framework for building AI-powered apps with familiar code-centric patterns. Genkit makes it easy to develop, integrate, and test AI features with observability and evaluations. Genkit works with various models and platforms. - GitHub, 4 月 24, 2025 にアクセス、 [https://github.com/firebase/genkit](https://github.com/firebase/genkit)
4. Introducing Firebase Genkit, 4 月 24, 2025 にアクセス、 [https://firebase.blog/posts/2024/05/introducing-genkit/](https://firebase.blog/posts/2024/05/introducing-genkit/)
5. How Firebase Genkit helped add AI to our Compass app - Google Developers Blog, 4 月 24, 2025 にアクセス、 [https://developers.googleblog.com/en/how-firebase-genkit-helped-add-ai-to-our-compass-app/](https://developers.googleblog.com/en/how-firebase-genkit-helped-add-ai-to-our-compass-app/)
6. Announcing Genkit for Python and Go - The Firebase Blog, 4 月 24, 2025 にアクセス、 [https://firebase.blog/posts/2025/04/genkit-python-go/](https://firebase.blog/posts/2025/04/genkit-python-go/)
7. Introducing Genkit for Go: Build scalable AI-powered apps in Go - Google Developers Blog, 4 月 24, 2025 にアクセス、 [https://developers.googleblog.com/en/introducing-genkit-for-go-build-scalable-ai-powered-apps-in-go/](https://developers.googleblog.com/en/introducing-genkit-for-go-build-scalable-ai-powered-apps-in-go/)
8. Genkit | Firebase - Google, 4 月 24, 2025 にアクセス、 [https://firebase.google.com/docs/genkit](https://firebase.google.com/docs/genkit)
9. Understanding Firebase Genkit and its Capabilities - Walturn, 4 月 24, 2025 にアクセス、 [https://www.walturn.com/insights/understanding-firebase-genkit-and-its-capabilities](https://www.walturn.com/insights/understanding-firebase-genkit-and-its-capabilities)
10. Awesome Firebase Genkit Overview, 4 月 24, 2025 にアクセス、 [https://www.trackawesomelist.com/xavidop/awesome-firebase-genkit/readme/](https://www.trackawesomelist.com/xavidop/awesome-firebase-genkit/readme/)
11. genkit/docs/firebase.md at main - GitHub, 4 月 24, 2025 にアクセス、 [https://github.com/firebase/genkit/blob/main/docs/firebase.md](https://github.com/firebase/genkit/blob/main/docs/firebase.md)
12. Monitor your Genkit features in production - The Firebase Blog, 4 月 24, 2025 にアクセス、 [https://firebase.blog/posts/2025/03/monitor-genkit-features-in-production](https://firebase.blog/posts/2025/03/monitor-genkit-features-in-production)
13. Get started with Genkit Monitoring - Firebase, 4 月 24, 2025 にアクセス、 [https://firebase.google.com/docs/genkit/observability/getting-started](https://firebase.google.com/docs/genkit/observability/getting-started)
14. Generating content with AI models | Genkit - Firebase - Google, 4 月 24, 2025 にアクセス、 [https://firebase.google.com/docs/genkit/models](https://firebase.google.com/docs/genkit/models)
15. Extracting structured data from PDFs using Gemini 2.0 and Genkit - Peter Friese, 4 月 24, 2025 にアクセス、 [https://peterfriese.dev/blog/2025/gemini-genkit-pdf-strucuted-data/](https://peterfriese.dev/blog/2025/gemini-genkit-pdf-strucuted-data/)
16. Multimodal generation with Firebase Genkit (version 0.5) - YouTube, 4 月 24, 2025 にアクセス、 [https://www.youtube.com/watch?v=yDFd5AZhsIk](https://www.youtube.com/watch?v=yDFd5AZhsIk)
17. Extracting structured data from PDFs using Gemini 2.0 and Genkit - Peter Friese, 4 月 24, 2025 にアクセス、 [https://peterfriese.dev/blog/2025/gemini-genkit-pdf-structured-data/](https://peterfriese.dev/blog/2025/gemini-genkit-pdf-structured-data/)
18. Get started | Genkit - Firebase - Google, 4 月 24, 2025 にアクセス、 [https://firebase.google.com/docs/genkit/get-started](https://firebase.google.com/docs/genkit/get-started)
19. How to use Gemini 1.0 Pro Vision in BigQuery | Google Cloud Blog, 4 月 24, 2025 にアクセス、 [https://cloud.google.com/blog/products/data-analytics/how-to-use-gemini-pro-vision-in-bigquery](https://cloud.google.com/blog/products/data-analytics/how-to-use-gemini-pro-vision-in-bigquery)
20. Leveraging the Gemini Pro Vision model for image understanding, multimodal prompts and accessibility | Solutions for Developers, 4 月 24, 2025 にアクセス、 [https://developers.google.com/learn/pathways/solution-ai-gemini-images](https://developers.google.com/learn/pathways/solution-ai-gemini-images)
21. Building an Image Data Extractor Using Gemini Vision LLM - Analytics Vidhya, 4 月 24, 2025 にアクセス、 [https://www.analyticsvidhya.com/blog/2023/12/building-an-image-data-extractor-using-gemini-vision-llm/](https://www.analyticsvidhya.com/blog/2023/12/building-an-image-data-extractor-using-gemini-vision-llm/)
22. Gemini Vision API Guide: Image, Video, and Document AI with Google Gemini - VideoSDK, 4 月 24, 2025 にアクセス、 [https://www.videosdk.live/developer-hub/ai/gemini-vision-api](https://www.videosdk.live/developer-hub/ai/gemini-vision-api)
23. 7 examples of Gemini's multimodal capabilities in action - Google Developers Blog, 4 月 24, 2025 にアクセス、 [https://developers.googleblog.com/en/7-examples-of-geminis-multimodal-capabilities-in-action/](https://developers.googleblog.com/en/7-examples-of-geminis-multimodal-capabilities-in-action/)
24. Cloud Vision API documentation, 4 月 24, 2025 にアクセス、 [https://cloud.google.com/vision/docs](https://cloud.google.com/vision/docs)
25. Vision AI: Image and visual AI tools | Google Cloud, 4 月 24, 2025 にアクセス、 [https://cloud.google.com/vision](https://cloud.google.com/vision)
26. How I Use Gemini 2.0 Flash for OCR of Large PDFs - Apidog, 4 月 24, 2025 にアクセス、 [https://apidog.com/blog/gemini-2-0-flash-ocr/](https://apidog.com/blog/gemini-2-0-flash-ocr/)
27. OCR With Google AI, 4 月 24, 2025 にアクセス、 [https://cloud.google.com/use-cases/ocr](https://cloud.google.com/use-cases/ocr)
28. Unleashing the Power of Gemini 2.0: Why Enterprises and Developers Should Take Note, 4 月 24, 2025 にアクセス、 [https://opencv.org/blog/gemini2/](https://opencv.org/blog/gemini2/)
29. Is MistralOCR the Best OCR Model Yet?, 4 月 24, 2025 にアクセス、 [https://www.labellerr.com/blog/mistralocr-did-it-do-what-it-claim/](https://www.labellerr.com/blog/mistralocr-did-it-do-what-it-claim/)
30. What are advancements in OCR technologies in Q1 2025 using LLMs? - Octaria, 4 月 24, 2025 にアクセス、 [https://www.octaria.com/blog/what-are-advancements-in-ocr-technologies-in-q1-2025-using-llms](https://www.octaria.com/blog/what-are-advancements-in-ocr-technologies-in-q1-2025-using-llms)
31. ChatGPT, Claude and other AI models for OCR: pros and cons, 4 月 24, 2025 にアクセス、 [https://www.handwritingocr.com/blog/chatgpt-claude-and-ai-for-ocr](https://www.handwritingocr.com/blog/chatgpt-claude-and-ai-for-ocr)
32. Best small vision LLM for OCR? : r/LocalLLaMA - Reddit, 4 月 24, 2025 にアクセス、 [https://www.reddit.com/r/LocalLLaMA/comments/1f71k60/best_small_vision_llm_for_ocr/](https://www.reddit.com/r/LocalLLaMA/comments/1f71k60/best_small_vision_llm_for_ocr/)
33. Using Gemini to convert physical handwriting to markdown. : r/ObsidianMD - Reddit, 4 月 24, 2025 にアクセス、 [https://www.reddit.com/r/ObsidianMD/comments/1h7r18y/using_gemini_to_convert_physical_handwriting_to/](https://www.reddit.com/r/ObsidianMD/comments/1h7r18y/using_gemini_to_convert_physical_handwriting_to/)
34. Generate structured output with the Gemini API | Google AI for Developers, 4 月 24, 2025 にアクセス、 [https://ai.google.dev/gemini-api/docs/structured-output](https://ai.google.dev/gemini-api/docs/structured-output)
35. gemini-samples/examples/gemini-structured-outputs.ipynb at main - GitHub, 4 月 24, 2025 にアクセス、 [https://github.com/philschmid/gemini-samples/blob/main/examples/gemini-structured-outputs.ipynb](https://github.com/philschmid/gemini-samples/blob/main/examples/gemini-structured-outputs.ipynb)
36. Generate structured output (like JSON) using the Gemini API | Vertex AI in Firebase - Google, 4 月 24, 2025 にアクセス、 [https://firebase.google.com/docs/vertex-ai/structured-output](https://firebase.google.com/docs/vertex-ai/structured-output)
37. Understanding Genkit flows with Czech language tricks - DEV Community, 4 月 24, 2025 にアクセス、 [https://dev.to/denisvalasek/understanding-genkit-flows-with-czech-language-tricks-26i3](https://dev.to/denisvalasek/understanding-genkit-flows-with-czech-language-tricks-26i3)
38. [JS] Prompt 'rendering' action does not enforce json output when output schema is provided · Issue #1462 · firebase/genkit - GitHub, 4 月 24, 2025 にアクセス、 [https://github.com/firebase/genkit/issues/1462](https://github.com/firebase/genkit/issues/1462)
39. Getting Started with Firebase Genkit | Google Cloud Skills Boost, 4 月 24, 2025 にアクセス、 [https://www.cloudskillsboost.google/course_templates/1189/labs/515554](https://www.cloudskillsboost.google/course_templates/1189/labs/515554)
40. genkit/docs/plugins/firebase.md at main - GitHub, 4 月 24, 2025 にアクセス、 [https://github.com/firebase/genkit/blob/main/docs/plugins/firebase.md](https://github.com/firebase/genkit/blob/main/docs/plugins/firebase.md)
41. Guide to Using OCR for Receipt Recognition & Data Extraction - Docsumo, 4 月 24, 2025 にアクセス、 [https://www.docsumo.com/blogs/ocr/for-receipts](https://www.docsumo.com/blogs/ocr/for-receipts)
42. Guide to Unstract Receipt OCR & Receipt Scanner API, 4 月 24, 2025 にアクセス、 [https://unstract.com/blog/unstract-receipt-ocr-scanner-api/](https://unstract.com/blog/unstract-receipt-ocr-scanner-api/)
43. OCR Vs AI: 7 Differences, Pros, Cons, & Which To Choose - DocuClipper, 4 月 24, 2025 にアクセス、 [https://www.docuclipper.com/blog/ocr-vs-ai/](https://www.docuclipper.com/blog/ocr-vs-ai/)
44. Novel approaches to verify the correctness of data extraction from scanned documents, 4 月 24, 2025 にアクセス、 [https://www.wazokucrowd.com/challenges/novel-approaches-to-verify-the-correctness-of-data-extraction-from-scanned-documents/](https://www.wazokucrowd.com/challenges/novel-approaches-to-verify-the-correctness-of-data-extraction-from-scanned-documents/)
45. [P] OCR for extracting text from Shopping Receipts. : r/MachineLearning - Reddit, 4 月 24, 2025 にアクセス、 [https://www.reddit.com/r/MachineLearning/comments/18qki38/p_ocr_for_extracting_text_from_shopping_receipts/](https://www.reddit.com/r/MachineLearning/comments/18qki38/p_ocr_for_extracting_text_from_shopping_receipts/)
46. MC-OCR Challenge 2021: Simple approach for receipt information extraction and quality evaluation - ResearchGate, 4 月 24, 2025 にアクセス、 [https://www.researchgate.net/publication/357227853_MC-OCR_Challenge_2021_Simple_approach_for_receipt_information_extraction_and_quality_evaluation](https://www.researchgate.net/publication/357227853_MC-OCR_Challenge_2021_Simple_approach_for_receipt_information_extraction_and_quality_evaluation)
47. LLMs vs OCR Software for Data Extraction: Which One Should You Use? - Klippa, 4 月 24, 2025 にアクセス、 [https://www.klippa.com/en/blog/information/llms-vs-ocr-software/](https://www.klippa.com/en/blog/information/llms-vs-ocr-software/)
48. Gemini in Java with Vertex AI and LangChain4j - Google Codelabs, 4 月 24, 2025 にアクセス、 [https://codelabs.developers.google.com/codelabs/gemini-java-developers](https://codelabs.developers.google.com/codelabs/gemini-java-developers)
49. Tool calling | Genkit - Firebase, 4 月 24, 2025 にアクセス、 [https://firebase.google.com/docs/genkit/tool-calling](https://firebase.google.com/docs/genkit/tool-calling)
50. Tool calling | Genkit (Go) - Firebase, 4 月 24, 2025 にアクセス、 [https://firebase.google.com/docs/genkit-go/tool-calling](https://firebase.google.com/docs/genkit-go/tool-calling)
51. Function Calling with Firebase Genkit | Google Cloud Skills Boost, 4 月 24, 2025 にアクセス、 [https://www.cloudskillsboost.google/course_templates/1189/labs/515560?locale=zh_TW](https://www.cloudskillsboost.google/course_templates/1189/labs/515560?locale=zh_TW)
52. Learn to build and run AI powered apps at Firebase Demo Day '24, 4 月 24, 2025 にアクセス、 [https://developers.googleblog.com/en/firebase-demo-day-24/](https://developers.googleblog.com/en/firebase-demo-day-24/)
53. Giving your AI apps superpowers with Tool Calling - YouTube, 4 月 24, 2025 にアクセス、 [https://www.youtube.com/watch?v=IuZi09JfDo4](https://www.youtube.com/watch?v=IuZi09JfDo4)
54. Tools to Communicate with Third Party APIs - Google Cloud Skills Boost, 4 月 24, 2025 にアクセス、 [https://www.cloudskillsboost.google/course_templates/1189/video/515559](https://www.cloudskillsboost.google/course_templates/1189/video/515559)
55. generative-ai/gemini/function-calling/intro_function_calling.ipynb at main - GitHub, 4 月 24, 2025 にアクセス、 [https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/function-calling/intro_function_calling.ipynb](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/function-calling/intro_function_calling.ipynb)
56. google-cloud-vision · GitHub Topics, 4 月 24, 2025 にアクセス、 [https://github.com/topics/google-cloud-vision?l=python&o=desc&s=stars](https://github.com/topics/google-cloud-vision?l=python&o=desc&s=stars)
57. Try it! | Cloud Vision API, 4 月 24, 2025 にアクセス、 [https://cloud.google.com/vision/docs/drag-and-drop](https://cloud.google.com/vision/docs/drag-and-drop)
