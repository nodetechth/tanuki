# Tanuki ネイティブアプリ移行手順

このドキュメントは、現在のWeb版TanukiをExpo / React Nativeのネイティブアプリへ移していくための作業メモです。

## 1. 方針

まずはWeb版を「仕様の正」として残し、ネイティブ側は同じSupabase / API / Stripeの仕組みを使います。

作り直すもの:

- 画面UI
- 録音UI
- 音声再生UI
- オフライン保存
- プッシュ通知
- 端末内キャッシュ

できるだけ流用するもの:

- SupabaseのDB設計
- 記事データ
- 単語データ
- 添削API
- 課金API
- 記事投入スクリプト
- R2音声配信ルール

## 2. 作成した土台

今回、以下のフォルダを追加しました。

```text
apps/mobile/
```

これはExpo SDK 55のTypeScriptテンプレートを元にした、Tanukiネイティブ版の開始地点です。

主なファイル:

| ファイル | 役割 |
|---|---|
| `apps/mobile/App.tsx` | 最初のネイティブ画面 |
| `apps/mobile/app.json` | Expoアプリ設定 |
| `apps/mobile/package.json` | モバイルアプリ用の依存関係 |
| `apps/mobile/.env.example` | モバイル用の環境変数サンプル |

## 3. 起動方法

初回だけ依存関係を入れます。

```bash
npm run mobile:install
```

その後、開発サーバーを起動します。

```bash
npm run mobile:start
```

iPhoneシミュレーターで開く場合:

```bash
npm run mobile:ios
```

Androidエミュレーターで開く場合:

```bash
npm run mobile:android
```

実機で確認する場合は、Expo GoアプリでQRコードを読み取ります。

Development Buildで確認する場合は、Expo GoではなくTanuki専用の開発用アプリを端末に入れます。

## Development Buildで実機確認する

Auth、録音、通知、ネイティブ固有機能を確認する段階ではExpo GoではなくDevelopment Buildを使います。

追加済みの設定:

| ファイル | 内容 |
|---|---|
| `apps/mobile/eas.json` | Development Build用のEAS設定 |
| `apps/mobile/app.json` | `scheme: tanuki`、iOS Bundle ID、Android package |
| `apps/mobile/package.json` | `expo-dev-client` |

アプリID:

```text
iOS Bundle ID: jp.nodetech.tanuki
Android package: jp.nodetech.tanuki
Deep Link: tanuki://auth/callback
```

初回だけExpoアカウントにログインします。

```bash
cd apps/mobile
npx eas login
```

iPhone実機用のDevelopment Buildを作る場合:

```bash
npm run mobile:dev-build:ios
```

iOS Simulator用に作る場合:

```bash
npm run mobile:dev-build:ios-simulator
```

Android実機用に作る場合:

```bash
npm run mobile:dev-build:android
```

ビルド完了後、EASが表示するQRコードまたはURLから端末へインストールします。

インストール後は、Metro開発サーバーをDevelopment Build用に起動します。

```bash
cd apps/mobile
npx expo start --dev-client
```

Supabase Authを確認する前に、Supabase Dashboardの `Authentication > URL Configuration` のRedirect URLsへ以下を追加してください。

```text
tanuki://auth/callback
```

モバイル用 `.env` には公開値だけを入れます。

```text
EXPO_PUBLIC_APP_URL=https://tanuki.nodetech.jp
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

`SUPABASE_SERVICE_ROLE_KEY` やStripe/Azure/OpenAIの秘密キーは、モバイルアプリには入れません。

## 4. 画面移行の順番

### Step 1. ネイティブの画面骨格

対象:

- Home
- Shadowing
- Listening
- Search

目的:

- 下部タブの構成をWeb版と揃える
- 色、余白、文字サイズの基準を決める
- Web版のUIをそのままコピーせず、スマホアプリとして自然な形にする

現在の構成:

```text
apps/mobile/src/
  components/
    AppScrollView.tsx
    ArticleList.tsx
    BottomTabs.tsx
    ListHeader.tsx
    SectionCard.tsx
  data/
    mock.ts
  screens/
    HomeScreen.tsx
    ShadowingScreen.tsx
    ListeningScreen.tsx
    SearchScreen.tsx
  theme.ts
  types.ts
```

この段階では、まず画面の器を作り、Web版で固めてきたUIの方向性をネイティブで再現できるようにしています。

型チェックは以下で実行します。

```bash
npm run mobile:typecheck
```

### Step 2. Auth / Supabase接続

対象:

- メールアドレス + パスワードログイン
- セッション保持
- 課金状態取得

注意:

- Expoで使う公開環境変数は `EXPO_PUBLIC_` から始めます。
- Service Role Keyは絶対にモバイルアプリへ入れません。
- 管理者判定や添削処理はサーバー側APIで行います。

現在は、モバイル版オンボーディングにメールアドレス + パスワードの登録/ログインUIを追加しています。

実装ファイル:

| ファイル | 役割 |
|---|---|
| `apps/mobile/src/lib/supabase.ts` | モバイル用Supabaseクライアント。Anon Keyだけを使う |
| `apps/mobile/src/hooks/useAuth.ts` | メールアドレス + パスワード登録/ログイン、セッション保持、ログアウト |
| `apps/mobile/src/screens/OnboardingScreen.tsx` | 初回の登録/ログインと学習設定UI |
| `apps/mobile/src/screens/HomeScreen.tsx` | ログイン状態と学習設定の確認UI |

### 初回オンボーディング

初回起動時は、先にメール登録/ログインを行います。

理由:

- ログイン前にレベル/用途を聞くと、ログアウト後に再度初回ユーザー扱いになりやすい
- 先にSupabase Authの `user_id` を確定すると、既存プロフィールを取得して再質問を避けられる
- レベル/用途は `user_profiles` に保存し、ログインユーザーに紐づけて管理できる

現在の流れ:

```text
アプリ起動
↓
メール登録/ログイン
↓
既存 user_profiles を確認
↓
未完了の場合だけレベル・用途を選択
↓
user_profiles に保存
↓
Homeへ進む
```

オンボーディングで聞く項目:

| 項目 | 選択肢 |
|---|---|
| レベル | 初級 / 中級 / 上級 |
| 用途 | カジュアル / ビジネス / 試験 |

表示文:

```text
選択した用途・レベルであなたに合わせた英語の例文を作成します。
```

受け皿のDB:

```text
supabase/20260512_user_profiles.sql
```

本番Supabaseへ適用後、モバイル版は `user_profiles` を直接読み書きします。RLSにより、自分のプロフィールだけ読める/保存できる設計です。

### Supabase Authの確認手順

1. `apps/mobile/.env` を作ります。

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

2. `apps/mobile/.env` に公開用の値だけを入れます。

```text
EXPO_PUBLIC_APP_URL=https://tanuki.nodetech.jp
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

`SUPABASE_SERVICE_ROLE_KEY` は絶対に `apps/mobile/.env` へ入れません。モバイルアプリに入れた値は、ビルド後にユーザー端末へ配布される前提で考えてください。

3. Supabase管理画面でリダイレクトURLを許可します。

Supabase Dashboardの `Authentication > URL Configuration` で、Redirect URLsに以下を追加します。

```text
tanuki://auth/callback
```

Expo Goで確認する場合、開発環境によってはExpo Go用のURLが使われます。その場合はアプリ起動後に生成される認証URLを確認して、同じ形式のURLをRedirect URLsへ追加します。実運用ではDevelopment Buildまたは本番アプリで `tanuki://auth/callback` を使う想定です。

4. モバイルアプリを起動します。

```bash
npm run mobile:start
```

5. オンボーディング画面でメールアドレスと6文字以上のパスワードを入力します。

初回は `登録`、登録済みの場合は `ログイン` を押します。ログイン後にレベル/用途の選択画面へ進めれば接続確認は完了です。

Supabase Authでメール確認が有効な場合、初回登録後に確認メールが送信されます。検証を優先する間は、Supabase管理画面の Authentication > Providers > Email でメール確認をOFFにすると、登録直後にそのままログイン状態で確認できます。本番運用ではメール確認ON/OFFの方針を別途決めます。

この段階では課金状態の取得までは未接続です。次に、ログイン済みユーザーのセッションを使ってWeb版APIへAuthorizationヘッダーを渡す実装へ進みます。

### Step 3. Shadowing

対象:

- シャドーイング教材一覧
- 記事詳細
- 録音
- 添削提出
- 添削完了通知

ネイティブ化で重要な点:

- Webの `MediaRecorder` は使えません。
- Expoでは録音用ライブラリを使います。
- 添削はバックグラウンド処理を前提にし、完了後に通知する設計にします。

### Step 4. Listening

対象:

- リスニング教材一覧
- 音声再生
- 速度調整
- US/UK音声切替
- 文タップで指定位置から再生
- オフライン保存

ネイティブ化で重要な点:

- 音声ファイルの端末キャッシュを使えるようにします。
- 無料ユーザーにも保存UIは出し、タップ時に有料CTAを表示します。
- 実際のオフライン音声保存はネイティブ側で実装します。

### Step 5. Search / Word Review

対象:

- 単語検索
- 活用形候補選択
- 単語保存
- フォルダ
- フラッシュカード復習

注意:

- 単語フォルダと保存単語はDB化済みの設計に寄せます。
- ローカルキャッシュは表示高速化のために使い、正本はSupabaseに置きます。

## 5. API方針

ネイティブアプリから直接呼ぶもの:

- Supabase Auth
- Supabaseの公開RLS付き読み取り

必ずサーバーAPI経由にするもの:

- 添削提出
- Azure / OpenAI / ElevenLabs / Stripeなど秘密キーを使う処理
- 管理者判定
- 課金状態の同期
- R2署名付きURLが必要な配信

## 6. 直近の次タスク

1. `apps/mobile` の依存関係をインストールする
2. Expoアプリが起動するか確認する
3. Home / Shadowing / Listening / Search の画面コンポーネントを分割する
4. Supabase Authを接続する
5. Web版の `/api/listening/articles` をネイティブから読める形にする
6. 録音ライブラリと音声再生ライブラリを選定する

## 8. 記事一覧API接続

モバイル側では、まず既存WebのAPIをそのまま使います。

```text
GET /api/listening/articles
```

接続先のベースURLは以下で設定します。

```text
apps/mobile/.env
EXPO_PUBLIC_APP_URL=https://tanuki.nodetech.jp
```

未設定の場合は `https://tanuki.nodetech.jp` を使います。

実装ファイル:

| ファイル | 役割 |
|---|---|
| `apps/mobile/src/config.ts` | API接続先URL |
| `apps/mobile/src/api/articles.ts` | 既存APIから記事一覧を取得 |
| `apps/mobile/src/hooks/useArticles.ts` | Shadowing / Listening別に記事を取得 |
| `apps/mobile/src/components/ArticleListStatus.tsx` | 読み込み中/フォールバック表示 |

API接続に失敗した場合は、開発中でも画面確認できるように `apps/mobile/src/data/mock.ts` のサンプル記事を表示します。

## 7. 注意点

- Web版のCSSはReact Nativeでは使えません。
- ただし、色・余白・文字サイズ・画面構成の考え方は流用できます。
- まずはWeb版と完全一致を狙わず、スマホアプリとして破綻しない操作感を優先します。
- 秘密キーはモバイルアプリへ絶対に入れません。
