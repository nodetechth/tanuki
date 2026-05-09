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
5. Shadowing教材は `gpt-4o-mini-tts` で音声を生成する
6. Listening教材はElevenLabsでUS/UK音声とタイムスタンプを生成する
7. 音声を聞いて確認する
8. 問題なければ音声をR2などへアップロードする
9. JSONの `audioUrl` / `audioSources` を更新する
10. Supabaseの `listening_articles` へupsertする

現時点では、音声生成後のJSONをSupabaseへまとめて投入するところまで、スクリプトで進められる状態にしています。
R2への音声アップロードだけは、現時点では別作業です。

## 使うファイル

| file | purpose |
| --- | --- |
| `templates/listening-articles.prompt.template.md` | 記事をまとめて作成するためのプロンプト |
| `templates/listening-articles.batch.template.json` | 記事JSONのテンプレート |
| `scripts/content/generate-article-audio.mjs` | 記事JSONから音声を生成するスクリプト |
| `scripts/content/generate-elevenlabs-listening-audio.mjs` | Listening教材用にElevenLabsのUS/UK音声と文タイムスタンプを生成するスクリプト |
| `scripts/content/upsert-listening-articles.mjs` | 記事JSONをSupabaseの `listening_articles` へまとめて投入するスクリプト |
| `scripts/content/check-audio-delivery.mjs` | R2配信URLのCORS/Range/Content-Typeを確認するスクリプト |
| `docs/content/listening-article-workflow.md` | この手順書 |
| `docs/content/r2-audio-delivery.md` | R2音声配信の置き場所・URL・CORS・有料保護方針 |

## 作業前の準備

ターミナルでプロジェクトフォルダへ移動します。

```bash
cd /Users/hiro/Downloads/1_tanuki
```

OpenAIとElevenLabsのAPIキーが `.env.local` に入っている必要があります。

```bash
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_US_VOICE_ID=...
ELEVENLABS_UK_VOICE_ID=...
```

DB投入を行う場合は、Supabaseの接続情報も `.env.local` に入っている必要があります。

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` はDBへ書き込みできる強い権限のキーです。
このキーは絶対にGitHubへpushしないでください。
ブラウザ側のコード、テンプレート、手順書にも直接貼らないでください。

`.env.local` はGitHubへpushしない設定になっています。
APIキーを `templates/`、`docs/`、`scripts/` のファイルへ直接書かないでください。

`ELEVENLABS_US_VOICE_ID` はアメリカ英語の声、`ELEVENLABS_UK_VOICE_ID` はイギリス英語の声です。記事JSON内の `tts.voices.us.voiceId` / `tts.voices.uk.voiceId` に実際のVoice IDが入っている場合は、そちらが優先されます。

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

注意: `npm run tts:articles` はOpenAI TTS用です。`contentType=shadowing` の音声生成に使います。`contentType=listening` で `tts.provider=elevenlabs` の記事はスキップされます。リスニング教材は次のStepでElevenLabsを使って作ります。

## Step 8-2. Listening音声をElevenLabsで生成する

Listening教材は、1記事につき以下の2つを作ります。

- アメリカ英語音声: `us`
- イギリス英語音声: `uk`

さらに、文をタップしたらその文から再生できるように、ElevenLabsのtimestamps/alignmentから文ごとの開始秒・終了秒も自動で作ります。

まずは必ずドライランで確認します。ドライランは音声を作らないので、クレジットを消費しません。

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json --dry-run true
```

別名のJSONを使う場合:

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.2026-05-batch-001.json --dry-run true
```

ドライランで確認すること:

- `DRYRUN` と表示されている
- `us` と `uk` の2つが対象になっている
- sentence数が想定どおり
- 生成対象の記事IDが正しい

問題なければ、実際に音声を生成します。

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json
```

特定の記事だけ生成したい場合:

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json --only listening-sample-library-spaces
```

アメリカ英語だけ、またはイギリス英語だけ作り直したい場合:

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json --only listening-sample-library-spaces --accents us --force true
```

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json --only listening-sample-library-spaces --accents uk --force true
```

生成後は以下のフォルダに音声が出ます。

```text
scripts/content/audio-output/<batchId>-<timestamp>/
```

中身の例:

```text
listening/listening-sample-library-spaces/listening-sample-library-spaces-us-eleven_multilingual_v2.mp3
listening/listening-sample-library-spaces/listening-sample-library-spaces-uk-eleven_multilingual_v2.mp3
alignments/listening-sample-library-spaces/us.json
alignments/listening-sample-library-spaces/uk.json
updated-listening-articles.json
manifest.json
```

ファイルの意味:

| file | meaning |
| --- | --- |
| `*.mp3` | 実際に聞く音声ファイル |
| `alignments/*.json` | ElevenLabsから返ってきた文字単位タイムスタンプの確認用ファイル |
| `updated-listening-articles.json` | `timings.us/uk` が自動で入った記事JSON |
| `manifest.json` | どの記事・どの声・どの出力ファイルを作ったかの記録 |

通常は、生成後に `updated-listening-articles.json` を確認します。問題なければ、このJSONをDB投入用の元データにします。

入力ファイル自体を直接更新したい場合だけ、以下を使います。

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json --update-input true
```

ただし、最初は `--update-input true` は使わず、`updated-listening-articles.json` を見てから手動で採用する方が安全です。

R2などにアップロードしたURLが決まっている場合は、`--url-prefix` を指定すると `audioSources.us/uk` にURLを入れたJSONも作れます。

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json --url-prefix https://cdn.example.com/audio
```

この場合、以下のようなURLが `audioSources` に入ります。

```json
"audioSources": {
  "us": "https://cdn.example.com/audio/listening/article-id/article-id-us-eleven_multilingual_v2.mp3",
  "uk": "https://cdn.example.com/audio/listening/article-id/article-id-uk-eleven_multilingual_v2.mp3"
}
```

音声ファイルを実際にR2へアップロードする作業は、現時点では別作業です。このスクリプトは、ローカルに音声ファイルを作り、文ごとのタイムスタンプをJSONへ入れるところまで担当します。

R2の置き場所、URLルール、CORS、Rangeリクエスト確認は以下にまとめています。

```text
docs/content/r2-audio-delivery.md
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
manifest.json
```

`manifest.json` には、どの記事をどの設定で生成したかが記録されます。

音声確認ポイント:

- 読み間違いがないか
- 抜けている文がないか
- 速すぎないか
- 遅すぎないか
- シャドーイング用は真似しやすいか
- リスニング用はElevenLabs生成後に文タップ再生の開始位置が自然か
- 数字、日付、固有名詞の読み方が自然か

Listening教材の追加確認ポイント:

- US音声とUK音声の両方が自然に聞こえるか
- 切り替えたときに記事内容が同じか
- 文をタップしたとき、文の冒頭から再生されるか
- 文末で次の文に少しかかる程度なら許容。文の途中から始まる場合は再生成またはタイムスタンプ調整が必要
- 速度が速すぎる/遅すぎる場合は、記事の `wpm` またはElevenLabs側のvoice settingsを見直す

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

Listening教材のUS/UK音声を作り直す場合:

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json --only article-id --force true
```

片方だけ作り直す場合:

```bash
npm run tts:listening:elevenlabs -- --input templates/listening-articles.batch.template.json --only article-id --accents uk --force true
```

## Step 11. audioUrl / audioSourcesを更新する

音声確認後、音声ファイルをR2などへアップロードします。
R2配信の詳細ルールは `docs/content/r2-audio-delivery.md` を参照してください。

Shadowing教材はアップロード後に得られたURLを、記事JSONの `audioUrl` に入れます。

```json
"audioUrl": "https://audio.tanuki.nodetech.jp/content/shadowing/article-id/article-id-openai-gpt-4o-mini-tts-coral-135wpm.mp3"
```

Listening教材はElevenLabsでアメリカ英語/イギリス英語の2ファイルを作成し、`audioSources.us` と `audioSources.uk` に入れます。`audioUrl` は旧形式のフォールバックなので `null` のままで構いません。

```json
"audioUrl": null,
"audioSources": {
  "us": "https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-us-eleven_multilingual_v2.mp3",
  "uk": "https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-uk-eleven_multilingual_v2.mp3"
}
```

まだアップロード前なら `null` のままで問題ありません。

```json
"audioUrl": null
```

リスニング教材では、ElevenLabsで取得したalignmentから `paragraphs[].sentences[].timings.us/uk.start/end` も更新します。

R2へ配置後は、少なくとも1本のUS音声と1本のUK音声でCORS/Range確認をします。

```bash
npm run audio:check-delivery -- --url https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-us-eleven_multilingual_v2.mp3 --origin http://localhost:3000
```

本番originでも確認します。

```bash
npm run audio:check-delivery -- --url https://audio.tanuki.nodetech.jp/content/listening/article-id/article-id-us-eleven_multilingual_v2.mp3 --origin https://tanuki.nodetech.jp
```

## Step 12. DBへ入れる

最終確認が終わったJSONを、Supabaseの `listening_articles` へ入れます。

投入元として使うJSONは、基本的に次のどちらかです。

- 音声生成前の記事JSON: `templates/listening-articles.2026-05-batch-001.json`
- ElevenLabs生成後の記事JSON: `scripts/content/audio-output/.../updated-listening-articles.json`

Listening教材は、US/UK音声URLと文タイムスタンプを反映した `updated-listening-articles.json` を使うのがおすすめです。
Shadowing教材だけの場合は、テンプレート側のJSONでも問題ありません。

### 12-1. まずdry-runで確認する

いきなりDBへ書き込まず、必ずdry-runから始めます。
dry-runではSupabaseへ書き込みません。
また、Supabase接続情報がなくてもJSONの変換内容だけ確認できます。

```bash
npm run db:upsert-listening-articles -- --input templates/listening-articles.batch.template.json
```

別名のJSONを使う場合:

```bash
npm run db:upsert-listening-articles -- --input templates/listening-articles.2026-05-batch-001.json
```

ElevenLabs生成後のJSONを使う場合:

```bash
npm run db:upsert-listening-articles -- --input scripts/content/audio-output/<フォルダ名>/updated-listening-articles.json
```

表示される内容で、特に以下を確認します。

- `selectedArticles` が想定件数になっている
- `id` が重複していない
- `contentType` が `shadowing` / `listening` になっている
- `audioSources.us` / `audioSources.uk` がListening教材で `true` になっている
- `timedSentences` がListening教材で0のままになっていない
- `publishedAt` が想定日付になっている

このdry-runでは、下記も自動チェックします。

| check | 内容 |
| --- | --- |
| ID重複 | 同じ `id` が同じJSON内にあるとエラー |
| `contentType` | `shadowing` / `listening` 以外はエラー |
| `status` | `draft` / `reviewed` / `published` 以外はエラー |
| `wordCount` | 本文から数えた語数と大きくズレていないか |
| `wpm` | contentTypeごとの想定範囲と、`targetDurationSeconds` との整合 |
| Listening `audioSources` | `us` / `uk` のキーがあるか |
| Listening `sentences` | 各文に `id` / `en` / `ja` / `timings.us/uk` があるか |

### 12-1-1. 公開前の厳密チェック

音声生成まで終わり、DBへ入れる直前は `--strict true` を付けて確認します。

```bash
npm run db:upsert-listening-articles -- --input scripts/content/audio-output/<フォルダ名>/updated-listening-articles.json --strict true
```

または短い別名を使います。

```bash
npm run db:validate-listening-articles -- --input scripts/content/audio-output/<フォルダ名>/updated-listening-articles.json
```

`--strict true` では、Listening教材の以下も必須になります。

- `audioSources.us` が有効なURL
- `audioSources.uk` が有効なURL
- すべての `sentences[].timings.us.start/end` が数値
- すべての `sentences[].timings.uk.start/end` が数値
- 各文の `start < end`
- 同じ段落内でタイムスタンプが逆戻りしない

`status: draft` の制作途中JSONでは、音声URLやタイムスタンプが `null` のままで問題ありません。
ただし公開前JSONでは `status: published` にして、上記チェックを通してください。

特定の記事だけ確認したい場合:

```bash
npm run db:upsert-listening-articles -- --input templates/listening-articles.batch.template.json --only listening-sample-library-spaces
```

複数の記事だけ確認したい場合:

```bash
npm run db:upsert-listening-articles -- --input templates/listening-articles.batch.template.json --only article-id-1,article-id-2
```

### 12-2. 問題なければDBへupsertする

dry-runで問題がなければ、`--dry-run false` を付けてDBへ書き込みます。

```bash
npm run db:upsert-listening-articles -- --input templates/listening-articles.batch.template.json --dry-run false
```

ElevenLabs生成後のJSONをDBへ入れる場合:

```bash
npm run db:upsert-listening-articles -- --input scripts/content/audio-output/<フォルダ名>/updated-listening-articles.json --dry-run false
```

安全のため、`status: draft` / `status: reviewed` の記事は通常のupsertでは拒否されます。
公開する記事はJSON上で `status: published` にしてください。

制作途中の検証などでどうしてもdraftをDBへ入れる場合だけ、明示的に指定します。

```bash
npm run db:upsert-listening-articles -- --input templates/listening-articles.batch.template.json --includeDrafts true --dry-run false
```

`id` がすでにDBに存在する場合は、同じ `id` の記事を上書き更新します。
`id` が存在しない場合は、新規作成します。
このスクリプトは、JSONに存在しない記事をDBから削除しません。

書き込み後、以下のフォルダに実行記録が残ります。

```text
scripts/content/upsert-output/<batchId>-<timestamp>/manifest.json
```

`manifest.json` には、どの記事を投入したか、音声URLやタイムスタンプが入っていたかが記録されます。

### 12-2-1. seed/rollback方針

本番データは、以下の方針で管理します。

- 投入したJSONは消さずに残す
- `batchId` は毎回ユニークにする
- `scripts/content/upsert-output/<batchId>-<timestamp>/manifest.json` を実行記録として残す
- DBに出す記事だけ `status: published` にする
- 制作途中の記事は `status: draft` のままJSONに残し、通常upsertではDBへ入れない
- 修正中の記事は `status: reviewed` にしておき、最終確認後に `published` へ変更する

間違えた記事を戻す場合は、直前に投入した正しいJSONをもう一度upsertします。
`id` が同じ記事は上書き更新されるため、本文・タイトル・音声URLも戻せます。

完全削除が必要な場合は、アプリ表示への影響が大きいため、SQLで個別に削除する前に対象 `id` を確認してください。
削除よりも、修正版JSONで上書きする方が安全です。

### 12-3. DB投入後に画面で確認する

DB投入後は、開発サーバーを起動して画面で確認します。

```bash
npm run dev
```

確認ポイント:

- ListeningタブにDBへ入れた記事が表示される
- WPM順の並び替えが効く
- Listening記事でUS/UK音声切り替えUIが表示される
- 音声URLが入っている記事で再生できる
- 文をタップした時に該当箇所から再生される
- Shadowing記事では「この記事でシャドーイング」が表示される
- Shadowing記事を添削に出した時に、記事本文が正しく添削対象になる

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
| `wordCount` | `word_count` |
| `wpm` | `wpm` |
| `audioUrl` | `audio_url` |
| `audioSources` | `audio_sources` |
| `publishedAt` | `published_at` |

`targetDurationSeconds`、`status`、`tts` は制作管理用です。
現状のDBには入れません。

Listening教材向けの `audio_sources JSONB` は、US/UK音声URLを持つために使います。
既存の `audio_url` はShadowing教材と旧データのフォールバックとして残します。

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
| `audioUrl` | no | 旧形式/フォールバック用TTS音声URL。未生成なら `null` |
| `audioSources` | no | Listening教材のみ。`{ "us": "...", "uk": "..." }` でアメリカ英語/イギリス英語の音声URLを持つ |
| `tts` | no | 記事単位で声・速度・指示を上書きする場合に指定 |
| `paragraphs` | yes | Shadowingは `{ "en": "...", "ja": "..." }` の配列。Listeningは文単位再生用に `sentences` も持たせる |
| `status` | yes | `draft`, `reviewed`, `published` |

### Listening教材のparagraphs形式

リスニング教材はElevenLabsで音声を作成し、文をタップして該当箇所から再生できるようにします。記事作成時点で文単位の `sentences` を入れてください。

有料ユーザー向けにアメリカ英語/イギリス英語を切り替えられるようにするため、Listening教材は2つの音声ファイルを持ちます。無料ユーザーにも同じ切り替えUIを表示しますが、変更時は有料機能の案内を出します。

本番で音声URLを非公開にしたい場合は、フロントの表示制御だけでなく、API側で購読状態を確認して署名付きURLを返す設計にします。公開URLを直接埋め込む場合、UI上は制限できてもURL自体へのアクセスは完全には止められません。

```json
"audioUrl": null,
"audioSources": {
  "us": "https://example.com/audio/listening/article-id-us.mp3",
  "uk": "https://example.com/audio/listening/article-id-uk.mp3"
}
```

注意: 声やアクセントが違うと読み上げの長さが変わるため、文ごとの開始/終了秒も `us` と `uk` で別々に持たせます。旧形式の `start` / `end` はフォールバックとして残します。

```json
{
  "en": "The meeting was postponed again. No one seemed surprised.",
  "ja": "会議はまた延期されました。誰も驚いていないようでした。",
  "sentences": [
    {
      "id": "p1-s1",
      "en": "The meeting was postponed again.",
      "ja": "会議はまた延期されました。",
      "start": null,
      "end": null,
      "timings": {
        "us": { "start": null, "end": null },
        "uk": { "start": null, "end": null }
      }
    },
    {
      "id": "p1-s2",
      "en": "No one seemed surprised.",
      "ja": "誰も驚いていないようでした。",
      "start": null,
      "end": null,
      "timings": {
        "us": { "start": null, "end": null },
        "uk": { "start": null, "end": null }
      }
    }
  ]
}
```

`timings.us.start/end` と `timings.uk.start/end` はElevenLabsのtimestamps/alignment取得後に秒数で埋めます。Shadowing教材は短くOpenAI TTSを使うため、`audioSources` と `sentences` は不要です。

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
- Listening教材で `audioSources.us/uk` が未設定のまま `published` にしている
- Listening教材で `timings.us/uk` が `null` のまま `published` にしている
- `paragraphs` の `en` と `ja` の対応がズレている
- `id` が重複している
- APIキーをJSONや手順書に貼ってしまう

## 次に作ると便利なもの

- JSONを `src/lib/listening-articles.ts` へ変換するローカル確認用スクリプト
- 音声ファイルをR2へアップロードし、`audioUrl` を自動更新するスクリプト
