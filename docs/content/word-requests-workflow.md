# Word Requests Workflow

未登録単語検索で記録された `word_requests` を運用するための手順です。

## 目的

ユーザーが検索した未登録単語を定期的に確認し、追加すべき単語を単語DBへ入れた後、リクエスト状態を更新します。

状態は3つです。

| status | meaning |
| --- | --- |
| `pending` | 未対応。追加候補 |
| `added` | 単語DBへ追加済み |
| `dismissed` | 追加しない判断 |

## 使うコマンド

```bash
npm run db:word-requests
```

このコマンドは `.env.local` の以下を使います。

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` は強い権限のキーです。
GitHubへpushしないでください。

## Step 1. pendingの未登録単語をCSV出力する

```bash
npm run db:word-requests -- --status pending --format csv --output exports/word-requests-pending.csv
```

出力されるCSV:

| column | meaning |
| --- | --- |
| `query` | 検索された単語 |
| `status` | 現在の状態 |
| `count` | リクエスト回数 |
| `userCount` | リクエストしたユーザー数 |
| `firstRequestedAt` | 最初に検索された日時 |
| `lastRequestedAt` | 最後に検索された日時 |
| `requestIds` | 対象リクエストID |

基本的には `count` が多い単語から追加します。

## Step 2. JSONで確認する

CSVではなくJSONで見たい場合:

```bash
npm run db:word-requests -- --status pending --format json
```

全ステータスを見たい場合:

```bash
npm run db:word-requests -- --status all --format json
```

## Step 3. 追加する単語を決める

CSVを見て、追加する単語を決めます。

例:

```text
postpone
receipt
available
```

追加しない単語の例:

- タイポ
- 日本語
- 長すぎるフレーズ
- 固有名詞
- 不適切な語

## Step 4. 単語DBへ追加する

追加対象が決まったら、単語生成フローで `words` / `word_examples` へ入れます。

手順:

```text
docs/content/word-dictionary-workflow.md
```

単語DBへ入れた後、9例文が揃っているか確認します。

```bash
npm run db:check-word-examples
```

## Step 5. 追加済みにする

まずdry-runで確認します。

```bash
npm run db:word-requests -- --mark-added --words postpone,receipt,available
```

問題なければ、`--dry-run false` を付けて更新します。

```bash
npm run db:word-requests -- --mark-added --words postpone,receipt,available --dry-run false
```

単語リストをファイルで渡す場合:

```bash
npm run db:word-requests -- --mark-added --words-file exports/added-words.txt --dry-run false
```

`exports/added-words.txt` の例:

```text
postpone
receipt
available
```

デフォルトでは、同じ `query` の `pending` のみ `added` にします。
過去に `dismissed` にしたものも含めて更新したい場合だけ、`--includeAll true` を使います。

```bash
npm run db:word-requests -- --mark-added --words postpone --includeAll true --dry-run false
```

## Step 6. 追加しない単語をdismissedにする

まずdry-runで確認します。

```bash
npm run db:word-requests -- --mark-dismissed --words typo-word
```

問題なければ更新します。

```bash
npm run db:word-requests -- --mark-dismissed --words typo-word --dry-run false
```

個別IDで更新したい場合:

```bash
npm run db:word-requests -- --mark-dismissed --ids id1,id2 --dry-run false
```

## 運用頻度

MVP初期は週1回がおすすめです。

初期は単語DBが少ないため、未登録検索が多く出ます。
そのため、以下のように進めます。

1. 週1回CSV出力
2. 上位20-50語を追加候補にする
3. 単語生成
4. `db:upsert-words`
5. `db:check-word-examples`
6. `db:word-requests --mark-added`

## 将来的な管理画面

管理画面を作る場合は、以下の機能があれば十分です。

- pending一覧
- count順ソート
- query検索
- added / dismissed への変更
- 単語DBに存在するかの表示
- CSV export

ただしMVPではCLI運用で十分です。
