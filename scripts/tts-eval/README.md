# TTS Evaluation

同じ原稿から複数TTSモデルの音声を生成し、アプリ実装前に品質・速度・発音を聞き比べるためのローカル検証スクリプトです。

## 対象モデル

- OpenAI: `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd`
- ElevenLabs: `eleven_multilingual_v2`, `eleven_flash_v2_5`

## 準備

`.env.local` に以下を設定してください。

```bash
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

`ELEVENLABS_VOICE_ID` は ElevenLabs の Voice Library または Voices API で選んだ声のIDです。OpenAI側は未指定なら `coral` を使います。

## 実行

```bash
npm run tts:eval
```

生成結果は `scripts/tts-eval/output/<timestamp>/` に保存されます。各音声ファイルと `manifest.json` が出力されます。

原稿を変える場合は `scripts/tts-eval/manuscript.txt` を編集するか、別ファイルを指定します。

```bash
npm run tts:eval -- --text scripts/tts-eval/manuscript.txt
```

一部モデルだけ試す場合:

```bash
npm run tts:eval -- --only gpt-4o-mini-tts,eleven_flash_v2_5
```

声や速度を変える場合:

```bash
npm run tts:eval -- --openai-voice alloy --eleven-labs-voice-id <voice_id> --speed 0.95
```

`--speed` はOpenAI/ElevenLabsの両方に渡します。ElevenLabs側の対応範囲は `0.7` から `1.2` のため、範囲外の値はスクリプト側で丸めます。

## 聞き比べ観点

- 発音: 英語学習用途として明瞭か、単語の脱落や読み間違いがないか
- 自然さ: 抑揚、間、文末処理が不自然でないか
- 学習適性: シャドーイングしやすい速度とリズムか
- 長文安定性: 段落をまたいでも声質やテンポが崩れないか
- 運用性: レイテンシ、料金、文字数上限、API制限が用途に合うか

## 注意

OpenAI の `instructions` は `gpt-4o-mini-tts` のみに渡しています。`tts-1` と `tts-1-hd` には対応していないため、同じ原稿・声・速度だけで比較します。

ElevenLabs の `eleven_flash_v2_5` は低レイテンシ用途向けです。数字・日付・金額などの読み上げを評価するときは、原稿側で読み方を明示したケースも別途試してください。
