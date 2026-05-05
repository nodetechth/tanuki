"""
Convert OpenAI Batch word output into app assets.

Usage:
  python scripts/tanuki-word-gen/build_dictionary_assets.py \
    /path/to/batch_output.jsonl

Outputs:
  - src/lib/word-dictionary/sample-words.json
  - supabase/20260503_seed_sample_words.sql
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


LEVELS = ("beginner", "intermediate", "advanced")
PURPOSES = ("casual", "business", "toeic")


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def parse_batch_output(path: Path) -> list[dict]:
    words: list[dict] = []
    with path.open("r", encoding="utf-8") as source:
        for line in source:
            if not line.strip():
                continue
            item = json.loads(line)
            raw = item["response"]["body"]["choices"][0]["message"]["content"].strip()
            data = json.loads(raw)
            data["word"] = str(data["word"]).strip().lower()
            words.append(data)
    return sorted(words, key=lambda item: item["word"])


def validate_word(item: dict) -> None:
    examples = item.get("examples", {})
    missing: list[str] = []
    for level in LEVELS:
        for purpose in PURPOSES:
            example = examples.get(level, {}).get(purpose, {})
            if not example.get("sentence_en") or not example.get("sentence_jp"):
                missing.append(f"{level}/{purpose}")
    if missing:
        raise ValueError(f"{item.get('word', '?')} missing examples: {', '.join(missing)}")


def build_seed_sql(words: list[dict]) -> str:
    lines = [
        "-- Generated from OpenAI Batch dictionary output.",
        "-- Run after supabase/20260503_word_dictionary.sql.",
        "",
    ]

    for item in words:
        validate_word(item)
        word = item["word"]
        definitions = json.dumps(item.get("definitions", []), ensure_ascii=False)
        synonyms = json.dumps(item.get("synonyms", []), ensure_ascii=False)
        usage_notes = item.get("usage_notes", "")
        phonetic_jp = item.get("phonetic_jp", "")
        ipa = item.get("stress", "")

        lines.append(
            "insert into public.words "
            "(headword, phonetic_jp, ipa, definitions, usage_notes, synonyms) values "
            f"({sql_quote(word)}, {sql_quote(phonetic_jp)}, {sql_quote(ipa)}, "
            f"{sql_quote(definitions)}::jsonb, {sql_quote(usage_notes)}, "
            f"{sql_quote(synonyms)}::jsonb) "
            "on conflict (headword) do update set "
            "phonetic_jp = excluded.phonetic_jp, "
            "ipa = excluded.ipa, "
            "definitions = excluded.definitions, "
            "usage_notes = excluded.usage_notes, "
            "synonyms = excluded.synonyms, "
            "updated_at = now();"
        )

        for level in LEVELS:
            for purpose in PURPOSES:
                example = item["examples"][level][purpose]
                lines.append(
                    "insert into public.word_examples "
                    "(word_id, level, purpose, sentence_en, sentence_jp) "
                    "select id, "
                    f"{sql_quote(level)}, {sql_quote(purpose)}, "
                    f"{sql_quote(example['sentence_en'])}, {sql_quote(example['sentence_jp'])} "
                    "from public.words "
                    f"where headword = {sql_quote(word)} "
                    "on conflict (word_id, level, purpose) do update set "
                    "sentence_en = excluded.sentence_en, "
                    "sentence_jp = excluded.sentence_jp, "
                    "updated_at = now();"
                )
        lines.append("")

    return "\n".join(lines)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: build_dictionary_assets.py /path/to/batch_output.jsonl")

    root = Path(__file__).resolve().parents[2]
    source = Path(sys.argv[1]).expanduser().resolve()
    words = parse_batch_output(source)

    for item in words:
        validate_word(item)

    app_output = root / "src/lib/word-dictionary/sample-words.json"
    app_output.parent.mkdir(parents=True, exist_ok=True)
    app_output.write_text(
        json.dumps(words, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    sql_output = root / "supabase/20260503_seed_sample_words.sql"
    sql_output.write_text(build_seed_sql(words), encoding="utf-8")

    print(f"Wrote {len(words)} words to {app_output}")
    print(f"Wrote seed SQL to {sql_output}")


if __name__ == "__main__":
    main()
