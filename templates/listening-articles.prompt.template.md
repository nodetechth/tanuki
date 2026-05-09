# Listening / Shadowing Articles Batch Prompt

以下の条件で、英語学習アプリ用の記事をまとめて作成してください。
出力はJSONのみ。Markdown、説明文、コードフェンスは不要です。

## 目的

- シャドーイング教材: 発音添削に出しやすい短い英文
- リスニング教材: 内容理解、語彙確認、録音して聞き返す練習用の英文

## 作成数

- shadowing: 10本
- listening: 10本

## 共通条件

- トップレベルJSONは `version`, `batchId`, `notes`, `ttsDefaults`, `articles` を持つ
- `version` は `1`
- `batchId` は `YYYY-MM-topic-001` の形式
- `ttsDefaults.model` は `gpt-4o-mini-tts`
- `ttsDefaults.voice` は `coral`
- `ttsDefaults.responseFormat` は `mp3`
- `ttsDefaults.speed` は `1`
- `articles` は配列
- すべての記事に一意な `id` を付ける
- `id` は英小文字、数字、ハイフンのみ
- `publishedAt` は `YYYY-MM-DD`
- `audioUrl` は `null`
- `tts.status` は `pending`
- `tts.voice` は `coral`
- `tts.instructions` は記事タイプに合わせて英語で短く書く
- `paragraphs` は `{ "en": "...", "ja": "..." }` の配列
- 英文と日本語訳の段落数を一致させる
- `status` は `draft`

## contentType

`contentType` は以下のどちらか。

- `shadowing`
- `listening`

## level

`level` と `levelLabel` は以下の対応にする。

- `beginner` / `初級`
- `intermediate` / `中級`
- `advanced` / `上級`

## category

カテゴリは以下からバランスよく使う。

- `生活`
- `ビジネス`
- `ニュース`
- `テクノロジー`

## Shadowing条件

- `contentType`: `shadowing`
- 30秒前後で読める量
- 60-120 words
- 1段落
- `targetDurationSeconds`: 30-60
- `wpm`: 110-145
- 文章は短く、音読しやすい
- 発音練習に向く自然な句切れを入れる
- 難しすぎる固有名詞や数字を避ける

## Listening条件

- `contentType`: `listening`
- 2-3分で読める量
- 280-500 words
- 3-6段落
- `targetDurationSeconds`: 120-180
- `wpm` は入れない
- 話題の導入、具体例、まとめがある構成
- 長すぎる一文を避ける
- 語彙学習に使いやすい自然な本文
- `audioSources` は `{ "us": null, "uk": null }`
- `tts.provider` は `elevenlabs`
- `tts.voices.us.voiceId` は `ELEVENLABS_US_VOICE_ID`
- `tts.voices.uk.voiceId` は `ELEVENLABS_UK_VOICE_ID`
- 各段落に `sentences` を入れ、英日を文単位に分割する
- 各sentenceは `start`, `end`, `timings.us`, `timings.uk` を `null` で持つ
- ElevenLabs生成後、アメリカ英語とイギリス英語で別々の開始/終了秒を `timings` に埋める

## WPMとTTS

- `wpm` はShadowing教材だけに入れる
- ShadowingのTTS生成スクリプト側で `wpm` から `speed` を計算するため、記事単位の `tts.speed` は基本的に入れない
- Listening教材はElevenLabsでUS/UK音声を作るため、記事JSONには `wpm` を入れない
- どうしても個別調整が必要な場合だけ `tts.speed` を入れる

## JSONスキーマ例

```json
{
  "version": 1,
  "batchId": "2026-05-daily-life-001",
  "notes": "短いシャドーイング教材と2-3分のリスニング教材をまとめて作成。",
  "ttsDefaults": {
    "provider": "openai",
    "model": "gpt-4o-mini-tts",
    "voice": "coral",
    "responseFormat": "mp3",
    "speed": 1,
    "instructions": "Speak clearly in natural American English for an English-learning exercise. Keep a calm, friendly, professional tone. Use natural sentence stress and short pauses between paragraphs."
  },
  "articles": [
    {
      "id": "shadowing-example-id",
      "contentType": "shadowing",
      "category": "生活",
      "level": "beginner",
      "levelLabel": "初級",
      "publishedAt": "2026-05-05",
      "title": "Example Title",
      "description": "日本語の短い説明。",
      "targetDurationSeconds": 35,
      "wordCount": 75,
      "wpm": 125,
      "audioUrl": null,
      "tts": {
        "status": "pending",
        "voice": "coral",
        "instructions": "Speak clearly for a shadowing exercise. Keep the rhythm steady and easy to repeat."
      },
      "paragraphs": [
        {
          "en": "English paragraph here.",
          "ja": "日本語訳をここに入れる。"
        }
      ],
      "status": "draft"
    },
    {
      "id": "listening-example-id",
      "contentType": "listening",
      "category": "生活",
      "level": "intermediate",
      "levelLabel": "中級",
      "publishedAt": "2026-05-05",
      "title": "Example Listening Title",
      "description": "日本語の短い説明。",
      "targetDurationSeconds": 150,
      "wordCount": 330,
      "audioUrl": null,
      "audioSources": { "us": null, "uk": null },
      "tts": {
        "status": "pending",
        "provider": "elevenlabs",
        "model": "eleven_multilingual_v2",
        "voices": {
          "us": { "voiceId": "ELEVENLABS_US_VOICE_ID", "label": "American English" },
          "uk": { "voiceId": "ELEVENLABS_UK_VOICE_ID", "label": "British English" }
        },
        "instructions": "Speak clearly for a listening exercise. Keep a calm pace and use natural pauses between paragraphs."
      },
      "paragraphs": [
        {
          "en": "English sentence one. English sentence two.",
          "ja": "日本語訳の一文目。日本語訳の二文目。",
          "sentences": [
            {
              "id": "p1-s1",
              "en": "English sentence one.",
              "ja": "日本語訳の一文目。",
              "start": null,
              "end": null,
              "timings": {
                "us": { "start": null, "end": null },
                "uk": { "start": null, "end": null }
              }
            }
          ]
        }
      ],
      "status": "draft"
    }
  ]
}
```

このスキーマに合わせて、指定本数分の完全なJSONを出力してください。
