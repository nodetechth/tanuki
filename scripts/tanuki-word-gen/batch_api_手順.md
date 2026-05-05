# OpenAI Batch API 実行手順

## 1. 仮想環境を有効化

```bash
cd scripts/tanuki-word-gen
source venv/bin/activate
```

## 2. APIキーをセット

```bash
export OPENAI_API_KEY="<OPENAI_API_KEY>"
```

## 3. .jsonlファイルを生成

generate_sample_words.py の設定を確認

```python
USE_BATCH = True  # Trueになっているか確認
```

実行

```bash
python generate_sample_words.py
```

output/words_batch_input.jsonl が生成される

## 4. OpenAIダッシュボードでBatch Jobを作成

1. https://platform.openai.com/batches を開く
2. 「Create」をクリック
3. `output/words_batch_input.jsonl` をドラッグ＆ドロップ
4. 設定はデフォルトのままでOK
   - Completion window: 24 hours
   - Endpoint: /v1/chat/completions
   - Output Expiration: Never
5. 「Create」をクリック

## 5. 完了を待つ

- 50単語なら数分〜10分程度
- ステータスが completed になったら結果をダウンロード

## 6. 結果をパースする

generate_sample_words.py の設定を変更

```python
USE_BATCH = False
```

ダウンロードした結果ファイルを output/ に置いて parse_batch_output() を実行

## 注意

- .env と output/ と venv/ は .gitignore に追加しておく
- APIキーは絶対にファイルに直書きしない
- ターミナルを新しく開いたら 1 と 2 からやり直す
