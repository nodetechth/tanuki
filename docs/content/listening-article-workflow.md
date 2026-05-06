# Listening / Shadowing Article Workflow

リスニング記事とシャドーイング記事を作成し、音声を生成し、最終的にDBへ入れるための運用手順です。

この手順は、普段コードを触らない人でも作業できるように、できるだけ具体的に書いています。

## まず結論

記事は **1本ずつではなく、10-20本くらいをまとめてJSONで作成** するのがおすすめです。

理由:

- カテゴリやレベルの偏りを確認しやすい
- WPMや記事量のバランスを見やすい
- TTS音声もまとめて生成できる
- DB投入もまとめて行える

ただし、**最終チェックは記事単位** で行います。
特に音声は、記事ごとに読み間違い、速度、聞きやすさを確認してください。

## 全体フロー

1. 記事作成プロンプトで複数記事をまとめて作る
2. 生成されたJSONを記事バッチJSONとして保存する
3. JSONの形式と記事量を確認する
4. ローカル画面で見え方を確認する
5. `gpt-4o-mini-tts` で記事音声を生成する
6. 音声を聞いて確認する
7. 問題なければ音声をR2などへアップロードする
8. JSONの `audioUrl` を更新する
9. Supabaseの `listening_articles` へupsertする

現時点では、1-6までをローカルで安全に進められる状態にしています。
7-9はR2アップロード/DB投入スクリプトを別途作ると運用しやすくなります。

## 使うファイル

| file | purpose |
| --- | --- |
| `templates/listening-articles.prompt.template.md` | 記事をまとめて作成するためのプロンプト |
| `templates/listening-articles.batch.template.json` | 記事JSONのテンプレート |
| `scripts/content/generate-article-audio.mjs` | 記事JSONから音声を生成するスクリプト |
| `docs/content/listening-article-workflow.md` | この手順書 |

## 作業前の準備

ターミナルでプロジェクトフォルダへ移動します。

```bash
cd /Users/hiro/Downloads/1_tanuki
```

OpenAIのAPIキーが `.env.local` に入っている必要があります。

```bash
OPENAI_API_KEY=...
```

`.env.local` はGitHubへpushしない設定になっています。
APIキーを `templates/`、`docs/`、`scripts/` のファイルへ直接書かないでください。

## Step 1. 記事をまとめて作成する

まず、以下のプロンプトテンプレートを開きます。

```text
templates/listening-articles.prompt.template.md
```

この中身をChatGPTなどに渡して、記事JSONをまとめて作成します。

最初のおすすめ単位:

- shadowing 10本
- listening 10本

つまり合計20本くらいです。

少なめに試す場合:

- shadowing 3本
- listening 3本

このくらいから始めても問題ありません。

## Step 2. 記事JSONとして保存する

生成されたJSONを、テンプレートと同じ形で保存します。

テンプレート:

```text
templates/listening-articles.batch.template.json
```

実運用では、テンプレートを直接上書きせず、以下のような名前でコピーして使うのがおすすめです。

```text
templates/listening-articles.2026-05-batch-001.json
```

ファイル名の例:

```text
templates/listening-articles.2026-05-business-001.json
templates/listening-articles.2026-05-daily-life-001.json
templates/listening-articles.2026-05-news-001.json
```

## Step 3. JSONの形を確認する

保存したJSONが壊れていないか確認します。

```bash
node -e "JSON.parse(require('fs').readFileSync('templates/listening-articles.batch.template.json','utf8')); console.log('json ok')"
```

別名で保存した場合は、ファイル名を置き換えます。

```bash
node -e "JSON.parse(require('fs').readFileSync('templates/listening-articles.2026-05-batch-001.json','utf8')); console.log('json ok')"
```

`json ok` と出れば、JSONの形は問題ありません。

エラーが出た場合は、だいたい以下が原因です。

- カンマが足りない
- 最後の項目に余計なカンマがある
- ダブルクォート `"` が閉じていない
- Markdownのコードフェンス ``` が混ざっている

## Step 4. 記事内容を確認する

JSONが正しくても、記事内容の確認は必要です。

特に見るところ:

- `contentType=shadowing` が長すぎないか
- `contentType=listening` が短すぎないか
- `wordCount` が実際の英文量と大きくズレていないか
- `wpm` が学習用途として妥当か
- 英文と日本語訳の意味がズレていないか
- `keyWords` が本文に出てくる語になっているか
- `id` が重複していないか

## Step 5. ローカル画面で見え方を確認する

DBへ入れる前に、ローカルで見え方を確認するのが安全です。

確認したいこと:

- 一覧カードでタイトルが長すぎないか
- カテゴリ表示が自然か
- WPM順で並び替えた時に違和感がないか
- 詳細ページで英日表示が読みやすいか
- シャドーイング記事だけに「この記事でシャドーイング」が出るか
- リスニング記事には添削導線が出ていないか

現時点では、JSONをそのままローカル画面へ差し込む専用スクリプトは未作成です。
次の作業として、JSONから `src/lib/listening-articles.ts` またはDB seedへ変換するスクリプトを作ると運用が楽になります。

## Step 6. TTS生成前にドライランする

いきなり音声生成するとAPIコストがかかるので、まず `--dry-run` で確認します。

```bash
npm run tts:articles -- --input templates/listening-articles.batch.template.json --dry-run
```

別名のJSONを使う場合:

```bash
npm run tts:articles -- --input templates/listening-articles.2026-05-batch-001.json --dry-run
```

このコマンドは音声を生成しません。
代わりに、以下を確認できます。

- 対象記事数
- 各記事のWPM
- 予想秒数
- TTSに渡す `speed`
- 出力予定ファイル名

例:

```text
DRYRUN  shadowing-sample-short-update -> shadowing/shadowing-sample-short-update/gpt-4o-mini-tts-coral-135wpm.mp3 (135 WPM, speed 0.9, 266 chars)
```

この例では、記事の `wpm=135` に対して、TTSの `speed=0.9` が使われます。

## Step 7. WPMとTTS速度の考え方

記事JSONには `wpm` があります。
これは「この記事を何WPMくらいで読ませたいか」という目標値です。

TTS側には直接WPMを指定できないため、スクリプト側で `speed` に変換します。

計算式:

```text
speed = article.wpm / baseWpm
```

現在の `baseWpm` は `150` です。

例:

| article.wpm | TTS speed |
| --- | --- |
| 120 | 0.8 |
| 135 | 0.9 |
| 150 | 1.0 |
| 165 | 1.1 |

注意点:

- TTSの `speed` は完全なWPM指定ではありません
- 声、英文、句読点、段落間の間で実際の速さは揺れます
- 生成後に必ず聞いて確認してください

もし全体的に遅く感じる場合:

```bash
npm run tts:articles -- --input templates/listening-articles.batch.template.json --base-wpm 140
```

もし全体的に速く感じる場合:

```bash
npm run tts:articles -- --input templates/listening-articles.batch.template.json --base-wpm 160
```

記事単位でどうしても調整したい場合だけ、JSONの `tts.speed` を手動で入れます。

```json
"tts": {
  "status": "pending",
  "voice": "coral",
  "speed": 0.92,
  "instructions": "Speak clearly for a shadowing exercise. Keep the rhythm steady and easy to repeat."
}
```

通常は `tts.speed` は入れなくてよいです。

## Step 8. 音声を生成する

ドライランで問題なければ、音声を生成します。

```bash
npm run tts:articles -- --input templates/listening-articles.batch.template.json
```

別名のJSONを使う場合:

```bash
npm run tts:articles -- --input templates/listening-articles.2026-05-batch-001.json
```

特定の記事だけ生成したい場合:

```bash
npm run tts:articles -- --input templates/listening-articles.batch.template.json --only shadowing-sample-short-update
```

複数の記事だけ生成したい場合:

```bash
npm run tts:articles -- --input templates/listening-articles.batch.template.json --only shadowing-sample-short-update,listening-sample-library-spaces
```

## Step 9. 生成された音声を確認する

音声は以下に出力されます。

```text
scripts/content/audio-output/<batchId>-<timestamp>/
```

例:

```text
scripts/content/audio-output/2026-05-listening-seed-001-2026-05-05T05-49-38-978Z/
```

中には以下のように保存されます。

```text
shadowing/<article-id>/gpt-4o-mini-tts-coral-135wpm.mp3
listening/<article-id>/gpt-4o-mini-tts-coral-132wpm.mp3
manifest.json
```

`manifest.json` には、どの記事をどの設定で生成したかが記録されます。

音声確認ポイント:

- 読み間違いがないか
- 抜けている文がないか
- 速すぎないか
- 遅すぎないか
- シャドーイング用は真似しやすいか
- リスニング用は段落間の間が自然か
- 数字、日付、固有名詞の読み方が自然か

## Step 10. 音声に問題があった場合

読み間違いがある場合:

- 英文側で読み方を明示する
- 数字を単語に書き換える
- 略語を読ませたい形に書き換える

例:

```text
2026 -> twenty twenty-six
AI -> A I
3.5% -> three point five percent
```

速度が合わない場合:

- まず `--base-wpm` を調整して再生成する
- 特定の記事だけズレる場合は、その記事の `tts.speed` を入れる

1記事だけ作り直す場合:

```bash
npm run tts:articles -- --input templates/listening-articles.batch.template.json --only article-id
```

## Step 11. audioUrlを更新する

音声確認後、音声ファイルをR2などへアップロードします。
アップロード後に得られたURLを、記事JSONの `audioUrl` に入れます。

```json
"audioUrl": "https://example.com/audio/listening/article-id.mp3"
```

まだアップロード前なら `null` のままで問題ありません。

```json
"audioUrl": null
```

## Step 12. DBへ入れる

最終的には、JSONからSupabaseの `listening_articles` へ入れます。

JSONとDBの対応:

| JSON | DB |
| --- | --- |
| `id` | `id` |
| `contentType` | `content_type` |
| `category` | `category` |
| `level` | `level` |
| `levelLabel` | `level_label` |
| `title` | `title` |
| `description` | `description` |
| `paragraphs` | `body` |
| `keyWords` | `key_words` |
| `wordCount` | `word_count` |
| `wpm` | `wpm` |
| `audioUrl` | `audio_url` |
| `publishedAt` | `published_at` |

`targetDurationSeconds`、`status`、`tts` は制作管理用です。
現状のDBには入れません。

## JSON形式

トップレベルは以下です。

```json
{
  "version": 1,
  "batchId": "2026-05-listening-seed-001",
  "notes": "任意メモ",
  "ttsDefaults": {
    "provider": "openai",
    "model": "gpt-4o-mini-tts",
    "voice": "coral",
    "responseFormat": "mp3",
    "speed": 1,
    "instructions": "Speak clearly in natural American English for an English-learning exercise."
  },
  "articles": []
}
```

`articles[]` の各項目です。

| field | required | note |
| --- | --- | --- |
| `id` | yes | DB主キー。英小文字、数字、ハイフンのみ推奨 |
| `contentType` | yes | `shadowing` または `listening` |
| `category` | yes | 例: `生活`, `ビジネス`, `ニュース`, `テクノロジー` |
| `level` | yes | `beginner`, `intermediate`, `advanced` |
| `levelLabel` | yes | `初級`, `中級`, `上級` |
| `publishedAt` | yes | `YYYY-MM-DD` |
| `title` | yes | 英語タイトル |
| `description` | yes | 日本語の短い説明 |
| `targetDurationSeconds` | yes | 制作目標。DBには直接保存しないが検証に使う |
| `wordCount` | yes | 英文の概算語数 |
| `wpm` | yes | 想定読み上げ速度 |
| `audioUrl` | no | TTS音声URL。未生成なら `null` |
| `tts` | no | 記事単位で声・速度・指示を上書きする場合に指定 |
| `keyWords` | yes | 3-6語程度 |
| `paragraphs` | yes | `{ "en": "...", "ja": "..." }` の配列 |
| `status` | yes | `draft`, `reviewed`, `published` |

## ボリューム基準

### Shadowing

- 目安: 30秒前後
- 許容: 30-60秒
- 語数: 60-120 words
- 段落: 基本1段落
- 目的: 発音添削に出しやすい短い文章

### Listening

- 目安: 2-3分
- 許容: 2-4分
- 語数: 280-500 words
- 段落: 3-6段落
- 目的: 内容理解、語彙確認、録音して聞き返す練習

## よくあるミス

- JSONにMarkdownの ``` が混ざっている
- `contentType` が `shadowing` / `listening` 以外になっている
- `level` が日本語になっている
- `levelLabel` が英語になっている
- `wordCount` が本文と大きく違う
- `wpm` が未設定
- `paragraphs` の `en` と `ja` の対応がズレている
- `id` が重複している
- APIキーをJSONや手順書に貼ってしまう

## 次に作ると便利なもの

- JSONの語数、重複ID、contentType別の長さをチェックするバリデーションスクリプト
- JSONを `src/lib/listening-articles.ts` へ変換するローカル確認用スクリプト
- JSONをSupabase upsert SQLへ変換するスクリプト
- 音声ファイルをR2へアップロードし、`audioUrl` を自動更新するスクリプト
