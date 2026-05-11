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

この段階では、まだSupabaseやAPIには接続していません。まずは画面の器を作り、Web版で固めてきたUIの方向性をネイティブで再現できるようにしています。

型チェックは以下で実行します。

```bash
npm run mobile:typecheck
```

### Step 2. Auth / Supabase接続

対象:

- メールリンクログイン
- セッション保持
- 課金状態取得

注意:

- Expoで使う公開環境変数は `EXPO_PUBLIC_` から始めます。
- Service Role Keyは絶対にモバイルアプリへ入れません。
- 管理者判定や添削処理はサーバー側APIで行います。

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

## 7. 注意点

- Web版のCSSはReact Nativeでは使えません。
- ただし、色・余白・文字サイズ・画面構成の考え方は流用できます。
- まずはWeb版と完全一致を狙わず、スマホアプリとして破綻しない操作感を優先します。
- 秘密キーはモバイルアプリへ絶対に入れません。
