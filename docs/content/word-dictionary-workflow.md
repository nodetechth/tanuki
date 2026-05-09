# Word Dictionary Workflow

Tanukiの単語検索で使う `words` / `word_examples` を安全に投入するための手順です。

## まず結論

単語DB投入は、必ず以下の順番で行います。

1. 単語生成結果JSONを用意する
2. ローカルで9例文が揃っているかdry-run確認する
3. 問題がなければSupabaseへupsertする
4. 本番DB上でも9例文欠損がないか確認する
5. アプリの検索画面で数語を実際に検索する

DBへ書き込むコマンドは `--dry-run false` を付けた時だけ実行されます。
何も付けない場合はdry-runなので、DBは変更されません。

## 対象テーブル

事前に以下のmigrationがSupabaseへ適用されている必要があります。

```text
supabase/20260503_word_dictionary.sql
```

このmigrationが未適用の場合、`npm run db:check-word-examples` で以下のようなエラーになります。

```text
Could not find the table 'public.words' in the schema cache
```

この場合は、まずSupabase SQL Editorで `supabase/20260503_word_dictionary.sql` を適用してから、再度チェックしてください。

### words

単語そのものの情報を保存します。

| JSON | DB |
| --- | --- |
| `word` | `headword` |
| `phonetic_jp` | `phonetic_jp` |
| `stress` / `ipa` | `ipa` |
| `definitions` | `definitions` |
| `usage_notes` | `usage_notes` |
| `synonyms` | `synonyms` |

### word_examples

例文を保存します。
1単語につき、以下の9パターンが必要です。

| level | purpose |
| --- | --- |
| `beginner` | `casual` |
| `beginner` | `business` |
| `beginner` | `toeic` |
| `intermediate` | `casual` |
| `intermediate` | `business` |
| `intermediate` | `toeic` |
| `advanced` | `casual` |
| `advanced` | `business` |
| `advanced` | `toeic` |

注意: アプリ上の「試験」は、DB内部では `toeic` として扱います。

## 入力ファイル

標準の入力ファイルは以下です。

```text
src/lib/word-dictionary/sample-words.json
```

この形式のJSONを投入できます。

```json
[
  {
    "word": "available",
    "phonetic_jp": "アベイラブル",
    "stress": "/əˈveɪ.lə.bəl/",
    "definitions": [
      {
        "part_of_speech": "adjective",
        "definition_en": "Able to be used or obtained.",
        "definition_jp": "利用できること"
      }
    ],
    "usage_notes": "人や物の利用可能状態を表す形容詞です。",
    "synonyms": ["obtainable", "free", "accessible"],
    "examples": {
      "beginner": {
        "casual": {
          "sentence_en": "The book is available at the library.",
          "sentence_jp": "その本は図書館で利用できます。"
        }
      }
    }
  }
]
```

実際には `examples` に9パターンすべてが必要です。

OpenAI BatchのJSONL出力も読み込めます。

```text
scripts/tanuki-word-gen/output/batch_output.jsonl
```

## Step 1. dry-runで確認する

まず、標準の単語JSONを確認します。

```bash
npm run db:upsert-words
```

別ファイルを使う場合:

```bash
npm run db:upsert-words -- --input scripts/tanuki-word-gen/output/batch_output.jsonl
```

確認すること:

- `totalWords` が想定件数になっている
- `duplicateHeadwords` が空になっている
- `missingWords` が空になっている
- `exampleRows` が `expectedExampleRows` と同じになっている

例:

```text
Words: 50
Examples: 450/450
```

50語なら、50語 × 9例文 = 450例文です。

## Step 2. 欠損が出た場合

`missingWords` に以下のような表示が出た場合、その単語は9例文が揃っていません。

```json
{
  "headword": "available",
  "missing": ["advanced/toeic"]
}
```

この場合は、該当JSONの `examples.advanced.toeic` に `sentence_en` と `sentence_jp` を追加してから、再度dry-runします。

原則として、欠損があるままDB投入しません。
どうしても一時的に投入する場合だけ `--allow-incomplete true` を使えますが、MVP運用では使わない方針です。

## Step 3. Supabaseへupsertする

dry-runで問題がなければ、`--dry-run false` を付けてDBへ書き込みます。

```bash
npm run db:upsert-words -- --input src/lib/word-dictionary/sample-words.json --dry-run false
```

OpenAI BatchのJSONLを直接投入する場合:

```bash
npm run db:upsert-words -- --input scripts/tanuki-word-gen/output/batch_output.jsonl --dry-run false
```

このスクリプトはupsertです。

- 同じ `headword` が既にある場合は更新
- ない場合は新規作成
- 同じ `word_id + level + purpose` の例文が既にある場合は更新
- JSONに存在しない単語をDBから削除しない

書き込みには `.env.local` の以下が必要です。

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` は強い権限のキーなので、GitHubへpushしないでください。

## Step 4. 本番DBの9例文欠損を確認する

DB投入後、DB上でも9例文が揃っているか確認します。

```bash
npm run db:check-word-examples
```

`ok: true` なら問題ありません。

欠損がある場合は、以下のように表示されます。

```json
{
  "headword": "available",
  "missing": ["advanced/toeic"]
}
```

この場合は、元JSONを修正して再upsertします。

## Step 5. アプリで検索確認する

最後にアプリ上で数語を検索します。

確認ポイント:

- 意味が表示される
- IPA/カタカナ読みが表示される
- レベル/用途を変えると例文が変わる
- `casual` / `business` / `toeic` の例文が出る
- 未登録単語は未登録画面に流れる

## Step 6. word_requestsを追加済みにする

未登録単語リクエストから追加した単語は、`word_requests` 側も `added` に更新します。

手順:

```text
docs/content/word-requests-workflow.md
```

例:

```bash
npm run db:word-requests -- --mark-added --words postpone,receipt --dry-run false
```

## よくあるミス

- `word` が大文字混じりで重複している
- `examples.advanced.toeic` だけ欠けている
- `sentence_jp` が空欄
- 用途キーが `exam` になっている
- レベルキーが `初級` など日本語になっている
- JSONにMarkdownの ``` が混ざっている

用途は必ず以下の3つです。

```text
casual
business
toeic
```

## 既存のSQL seedについて

既存の `supabase/20260503_seed_sample_words.sql` は残します。
ただし、今後の運用ではJSON/JSONLを元に `npm run db:upsert-words` で投入する方針です。

SQL seedは初期サンプルやバックアップとして使います。
