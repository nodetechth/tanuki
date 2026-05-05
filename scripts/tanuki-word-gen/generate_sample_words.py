"""
Tanuki シャドーイングアプリ
50単語サンプル生成スクリプト（GPT-4.1 mini / Batch API対応）

使い方:
  1. pip install openai
  2. export OPENAI_API_KEY=""
  3. python generate_sample_words.py

出力:
  - output/words_batch_input.jsonl   → Batch API用入力ファイル
  - output/words_results.json        → 結果（通常API or Batch結果をパース後）
  - output/words_failed.json         → パース失敗したレコード
"""

import os
import json
import time
from openai import OpenAI

# ------------------------------------------------
# 設定
# ------------------------------------------------
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL = "gpt-4.1-mini"
OUTPUT_DIR = "output"
USE_BATCH = True  # True にするとBatch API使用（50%割引・最大24時間）

# ------------------------------------------------
# 50単語リスト（3レベル × 3ジャンル を均等カバー）
# ------------------------------------------------
WORDS = [
    # 初級 × カジュアル
    "grab", "tired", "weekend", "forget", "quiet", "neighborhood",
    # 初級 × ビジネス
    "meeting", "deadline", "report", "confirm", "schedule", "colleague",
    # 初級 × TOEIC
    "available", "receipt", "invoice", "branch", "inquiry", "notify",
    # 中級 × カジュアル
    "awkward", "overwhelm", "perspective", "eventually", "genuine",
    # 中級 × ビジネス
    "collaborate", "prioritize", "feedback", "initiative", "streamline", "negotiate",
    # 中級 × TOEIC
    "reimburse", "premises", "renovation", "itinerary", "accommodate",
    # 上級 × カジュアル
    "resonate", "ambivalent", "nuance", "drift", "unwind",
    # 上級 × ビジネス
    "leverage", "scalable", "bottleneck", "stakeholder", "pivot", "benchmark",
    # 上級 × TOEIC
    "compliance", "fiscal", "aggregate", "provision", "fluctuate",
]

# ------------------------------------------------
# プロンプト
# ------------------------------------------------
SYSTEM_PROMPT = """You are an English-Japanese dictionary specialized for Japanese learners.
For the given English word, respond with ONLY a valid JSON object (no markdown, no code block, no comments).

Output exactly this structure with all 9 example patterns (3 levels x 3 genres):

{
  "word": "<lowercase word>",
  "phonetic_jp": "<katakana reading>",
　"stress": "<IPA, must include slashes, e.g. /ɡræb/>",
  "definitions": [
    {
      "part_of_speech": "<noun|verb|adjective|adverb|etc.>",
      "definition_en": "<one clear sentence in simple English>",
      "definition_jp": "<one sentence in Japanese, ending with こと or さま>"
    }
  ],
  "usage_notes": "<short note in Japanese or empty string>",
  "synonyms": ["<word1>", "<word2>", "<word3>"],
  "examples": {
    "beginner": {
      "casual":   {"sentence_en": "", "sentence_jp": ""},
      "business": {"sentence_en": "", "sentence_jp": ""},
      "toeic":    {"sentence_en": "", "sentence_jp": ""}
    },
    "intermediate": {
      "casual":   {"sentence_en": "", "sentence_jp": ""},
      "business": {"sentence_en": "", "sentence_jp": ""},
      "toeic":    {"sentence_en": "", "sentence_jp": ""}
    },
    "advanced": {
      "casual":   {"sentence_en": "", "sentence_jp": ""},
      "business": {"sentence_en": "", "sentence_jp": ""},
      "toeic":    {"sentence_en": "", "sentence_jp": ""}
    }
  }
}

Level guidelines:
- beginner:     Short sentences (under 15 words). Basic vocabulary. Simple subject-verb structure.
- intermediate: Medium sentences (15-25 words). College-level vocabulary. Compound sentences OK.
- advanced:     Longer sentences (20-35 words). Sophisticated vocabulary and idiomatic expressions.

Genre guidelines:
- casual:   Natural everyday conversation. Personal experience. Relaxed but not slangy tone.
- business: Formal workplace English suitable for emails and meetings.
- toeic:    TOEIC Part 3-7 style. Office announcements, phone messages, meetings with specific numbers/dates/names."""


def make_user_message(word: str) -> str:
    return f"Word to process: {word}"


# ------------------------------------------------
# 通常API（即時結果確認用）
# ------------------------------------------------
def generate_normal(words: list[str]) -> tuple[list[dict], list[dict]]:
    results = []
    failed = []

    for i, word in enumerate(words, 1):
        print(f"[{i:02d}/{len(words)}] {word} ...", end=" ", flush=True)
        try:
            response = client.chat.completions.create(
                model=MODEL,
                max_tokens=1200,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": make_user_message(word)},
                ],
            )
            raw = response.choices[0].message.content.strip()
            data = json.loads(raw)
            results.append(data)
            print("✅")
        except json.JSONDecodeError as e:
            print(f"❌ JSONパースエラー: {e}")
            failed.append({"word": word, "error": str(e), "raw": raw})
        except Exception as e:
            print(f"❌ APIエラー: {e}")
            failed.append({"word": word, "error": str(e)})

        # レート制限対策（1秒待機）
        if i < len(words):
            time.sleep(1)

    return results, failed


# ------------------------------------------------
# Batch API（50%割引・最大24時間）
# ------------------------------------------------
def generate_batch_input(words: list[str], filepath: str):
    """Batch API用の .jsonl ファイルを生成"""
    lines = []
    for word in words:
        request = {
            "custom_id": f"word-{word}",
            "method": "POST",
            "url": "/v1/chat/completions",
            "body": {
                "model": MODEL,
                "max_tokens": 1200,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": make_user_message(word)},
                ],
            },
        }
        lines.append(json.dumps(request, ensure_ascii=False))

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"✅ Batch入力ファイル生成: {filepath}")
    print(f"   → OpenAI Dashboardで Batch Job を作成してください")
    print(f"   → https://platform.openai.com/batches")


def parse_batch_output(output_filepath: str) -> tuple[list[dict], list[dict]]:
    """Batch API結果ファイル（.jsonl）をパース"""
    results = []
    failed = []

    with open(output_filepath, "r", encoding="utf-8") as f:
        for line in f:
            item = json.loads(line)
            word = item["custom_id"].replace("word-", "")
            try:
                raw = item["response"]["body"]["choices"][0]["message"]["content"].strip()
                data = json.loads(raw)
                results.append(data)
            except Exception as e:
                failed.append({"word": word, "error": str(e)})

    return results, failed


# ------------------------------------------------
# 品質チェック表示
# ------------------------------------------------
def print_quality_check(results: list[dict]):
    print("\n" + "=" * 60)
    print("📋 品質チェックサマリー")
    print("=" * 60)

    issues = []
    for item in results:
        word = item.get("word", "?")
        checks = []

        # 9パターンが全部あるか
        examples = item.get("examples", {})
        for level in ["beginner", "intermediate", "advanced"]:
            for genre in ["casual", "business", "toeic"]:
                ex = examples.get(level, {}).get(genre, {})
                if not ex.get("sentence_en") or not ex.get("sentence_jp"):
                    checks.append(f"{level}/{genre} が空")

        # 長さチェック（beginnerは15語以内が目安）
        beginner_casual = examples.get("beginner", {}).get("casual", {}).get("sentence_en", "")
        word_count = len(beginner_casual.split())
        if word_count > 18:
            checks.append(f"beginner/casual が長すぎ ({word_count}語)")

        if checks:
            issues.append({"word": word, "issues": checks})
            print(f"⚠️  {word}: {', '.join(checks)}")
        else:
            print(f"✅ {word}")

    print(f"\n合計: {len(results)}件 / 問題あり: {len(issues)}件")
    return issues


# ------------------------------------------------
# メイン
# ------------------------------------------------
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if USE_BATCH:
        # Batch API: .jsonl ファイルを生成して終了
        batch_input_path = f"{OUTPUT_DIR}/words_batch_input.jsonl"
        generate_batch_input(WORDS, batch_input_path)
        print("\nBatch完了後、結果ファイルを以下で処理してください:")
        print("  USE_BATCH = False に変更し、parse_batch_output() を呼び出す")

    else:
        # 通常API: 即時生成
        print(f"🚀 {len(WORDS)}単語の生成を開始します（モデル: {MODEL}）\n")
        results, failed = generate_normal(WORDS)

        # 結果保存
        results_path = f"{OUTPUT_DIR}/words_results.json"
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        if failed:
            failed_path = f"{OUTPUT_DIR}/words_failed.json"
            with open(failed_path, "w", encoding="utf-8") as f:
                json.dump(failed, f, ensure_ascii=False, indent=2)
            print(f"\n⚠️  失敗: {len(failed)}件 → {failed_path}")

        print(f"\n✅ 結果保存: {results_path}")

        # 品質チェック
        print_quality_check(results)


if __name__ == "__main__":
    main()
