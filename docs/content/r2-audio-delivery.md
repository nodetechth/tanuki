# R2 Audio Delivery

Tanukiの教材音声をCloudflare R2から配信するための運用ルールです。

録音提出音声と教材音声は用途が違います。

- 録音提出音声: ユーザーの個人音声。R2に非公開保存し、サーバー側で署名付きURLを発行する
- 教材音声: アプリで再生する教材。MVPでは公開URLで配信し、将来的に有料保護が必要になったら署名付きURL/API経由へ移行する

## 1. 推奨方針

MVPでは、教材音声はR2の公開配信用バケットまたは公開prefixに置きます。

推奨URL:

```text
https://audio.tanuki.nodetech.jp
```

ただし、R2のcustom domainを使うには、対象ドメインまたはサブドメインをCloudflare側で扱える状態にする必要があります。
Xserver DNSだけで完結している場合は、以下のどちらかを選びます。

- 本番向け: `audio.tanuki.nodetech.jp` をCloudflareで扱えるようにしてR2 custom domainへ接続する
- 仮確認向け: Cloudflare managed `r2.dev` URLを使う

`r2.dev` は開発・確認用です。
本番公開では、キャッシュやアクセス制御を扱いやすいcustom domainを使う方針にします。

## 2. バケットとパス

既存の `tanuki-audio` バケットを使う場合でも、教材音声と提出音声はprefixで分けます。

```text
submissions/
content/
```

提出音声:

```text
submissions/<user-id>/<uuid>.webm
```

教材音声:

```text
content/shadowing/<article-id>/<article-id>-openai-gpt-4o-mini-tts-<voice>-<wpm>wpm.mp3
content/listening/<article-id>/<article-id>-us-eleven_multilingual_v2.mp3
content/listening/<article-id>/<article-id>-uk-eleven_multilingual_v2.mp3
```

`scripts/content/generate-elevenlabs-listening-audio.mjs` の出力は、ローカルでは以下のようになります。

```text
listening/<article-id>/<article-id>-us-eleven_multilingual_v2.mp3
listening/<article-id>/<article-id>-uk-eleven_multilingual_v2.mp3
```

R2へアップロードするときは、前に `content/` を付けます。

```text
content/listening/<article-id>/<article-id>-us-eleven_multilingual_v2.mp3
content/listening/<article-id>/<article-id>-uk-eleven_multilingual_v2.mp3
```

## 3. audioSources URLルール

R2の公開ベースURLを以下とします。

```text
NEXT_PUBLIC_AUDIO_BASE_URL=https://audio.tanuki.nodetech.jp
```

Listening教材の `audioSources` は以下の形にします。

```json
"audioSources": {
  "us": "https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-us-eleven_multilingual_v2.mp3",
  "uk": "https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-uk-eleven_multilingual_v2.mp3"
}
```

Shadowing教材の `audioUrl` は以下の形にします。

```json
"audioUrl": "https://audio.tanuki.nodetech.jp/content/shadowing/article-id/article-id-openai-gpt-4o-mini-tts-coral-135wpm.mp3"
```

注意:

- `audioSources.us` と `audioSources.uk` は必ず同じ本文から生成した音声にする
- US/UKで読み上げ時間が変わるため、文タイムスタンプは `timings.us` / `timings.uk` で別々に持つ
- 旧形式の `audioUrl` はフォールバックとして残す

## 4. CORS設定

教材音声はWebアプリから再生するため、R2バケットにCORSを設定します。

MVP推奨:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://tanuki.nodetech.jp"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": [
      "Accept-Ranges",
      "Content-Range",
      "Content-Length",
      "Content-Type",
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

本番ドメインが増えた場合は、`AllowedOrigins` に追加します。

例:

```json
"https://www.tanuki.nodetech.jp"
```

`AllowedOrigins: ["*"]` は確認中は便利ですが、本番ではアプリのoriginだけに絞る方針にします。

## 5. Rangeリクエスト確認

文タップ再生やシーク再生では、ブラウザが音声ファイルの途中から取得できる必要があります。
そのため、R2からの配信でRangeリクエストが効くことを確認します。

確認コマンド:

```bash
npm run audio:check-delivery -- --url https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-us-eleven_multilingual_v2.mp3 --origin http://localhost:3000
```

本番originで確認する場合:

```bash
npm run audio:check-delivery -- --url https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-us-eleven_multilingual_v2.mp3 --origin https://tanuki.nodetech.jp
```

確認する結果:

- `Range request returns partial content` が `ok: true`
- Range GETの `status` が `206`
- `content-range` が返る
- `CORS allows the app origin` が `ok: true`
- `Content-Type is audio` が `ok: true`

失敗した場合によく見るところ:

- CORSの `AllowedOrigins` にアプリのoriginが入っているか
- CORSの `AllowedMethods` に `GET` / `HEAD` が入っているか
- CORSの `AllowedHeaders` に `Range` が入っているか
- 音声ファイルアップロード時の `Content-Type` が `audio/mpeg` になっているか
- custom domain設定後にCloudflare側のキャッシュが古く残っていないか

## 6. ElevenLabs生成からDB投入までのURL反映

R2へアップロードする前に、URLルールを決めて `--url-prefix` を付けると、生成後JSONにURLを入れられます。

R2の公開URLに `content/` prefixを含める場合:

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json --url-prefix https://audio.tanuki.nodetech.jp/content
```

この場合、生成後の `updated-listening-articles.json` には以下が入ります。

```json
"audioSources": {
  "us": "https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-us-eleven_multilingual_v2.mp3",
  "uk": "https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-uk-eleven_multilingual_v2.mp3"
}
```

その後、音声ファイルをR2の同じkeyへアップロードします。

```text
content/listening/article-id/article-id-us-eleven_multilingual_v2.mp3
content/listening/article-id/article-id-uk-eleven_multilingual_v2.mp3
```

最後にDB投入します。

```bash
npm run db:upsert-listening-articles -- --input scripts/content/audio-output/<フォルダ名>/updated-listening-articles.json --dry-run false
```

## 7. 有料機能として守る場合

MVPでは、音声URLは公開URLとしてDBに保存します。
この場合、アプリUI上で無料ユーザーに再生を制限しても、URLを直接知っている人は音声にアクセスできます。

本当に有料ユーザーだけに配信したい場合は、以下のどちらかに移行します。

### 案A. 署名付きURL/API経由

DBにはR2 object keyだけ保存します。

```json
"audioSources": {
  "us": "r2://content/listening/article-id/article-id-us-eleven_multilingual_v2.mp3",
  "uk": "r2://content/listening/article-id/article-id-uk-eleven_multilingual_v2.mp3"
}
```

フロントは `/api/listening/audio-url?articleId=...&accent=us` のようなAPIを呼びます。
API側でログイン状態と課金状態を確認し、有料ユーザーだけ短時間の署名付きURLを返します。

利点:

- 課金状態で制御しやすい
- 既存のR2署名付きURL実装を流用しやすい

注意:

- audio要素のシーク時に署名付きURLの期限が切れないよう、期限を少し長めにする
- ネイティブアプリのオフライン保存と合わせて再設計が必要

### 案B. Cloudflare WAF/Token Authentication

R2 custom domain側でアクセス制御します。

利点:

- CDN/エッジ側で保護しやすい

注意:

- Vercel/Supabase/Stripeの課金状態と連携する設計が必要
- MVPでは実装コストが高い

現時点では、MVPは公開URLで進め、課金保護が必要になった段階で案Aを優先検討します。
