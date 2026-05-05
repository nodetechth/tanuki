import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findSampleWord, resolveWordLookup } from "@/lib/word-dictionary/search";
import type {
  WordDefinition,
  WordEntry,
  WordExample,
  WordLevel,
  WordPurpose,
} from "@/lib/word-dictionary/types";

type WordRow = {
  id: string;
  headword: string;
  phonetic_jp: string;
  ipa: string;
  definitions: WordDefinition[];
  usage_notes: string;
  synonyms: string[];
};

type ExampleRow = {
  level: WordLevel;
  purpose: WordPurpose;
  sentence_en: string;
  sentence_jp: string;
};

const levels: WordLevel[] = ["beginner", "intermediate", "advanced"];
const purposes: WordPurpose[] = ["casual", "business", "toeic"];

function emptyExamples(): WordEntry["examples"] {
  return levels.reduce((levelAcc, level) => {
    levelAcc[level] = purposes.reduce((purposeAcc, purpose) => {
      purposeAcc[purpose] = { sentence_en: "", sentence_jp: "" };
      return purposeAcc;
    }, {} as Record<WordPurpose, WordExample>);
    return levelAcc;
  }, {} as WordEntry["examples"]);
}

async function getDbWord(word: string): Promise<WordEntry | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const { data: wordRow, error: wordError } = await supabase
    .from("words")
    .select("id, headword, phonetic_jp, ipa, definitions, usage_notes, synonyms")
    .eq("headword", word)
    .maybeSingle<WordRow>();

  if (wordError || !wordRow) {
    return null;
  }

  const { data: exampleRows, error: exampleError } = await supabase
    .from("word_examples")
    .select("level, purpose, sentence_en, sentence_jp")
    .eq("word_id", wordRow.id)
    .returns<ExampleRow[]>();

  if (exampleError || !exampleRows) {
    return null;
  }

  const examples = emptyExamples();
  for (const example of exampleRows) {
    examples[example.level][example.purpose] = {
      sentence_en: example.sentence_en,
      sentence_jp: example.sentence_jp,
    };
  }

  return {
    word: wordRow.headword,
    phonetic_jp: wordRow.phonetic_jp,
    stress: wordRow.ipa,
    definitions: Array.isArray(wordRow.definitions) ? wordRow.definitions : [],
    usage_notes: wordRow.usage_notes,
    synonyms: Array.isArray(wordRow.synonyms) ? wordRow.synonyms : [],
    examples,
  };
}

export async function GET(request: NextRequest) {
  const lookup = resolveWordLookup(request.nextUrl.searchParams.get("word") ?? "");

  if (!lookup.query) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  const dbWord = await getDbWord(lookup.headword);
  if (dbWord) {
    return NextResponse.json({ word: dbWord, source: "database", lookup: lookup.lookup });
  }

  const sampleWord = findSampleWord(lookup.headword);
  if (sampleWord) {
    return NextResponse.json({ word: sampleWord, source: "sample", lookup: lookup.lookup });
  }

  return NextResponse.json({ error: "Word not found" }, { status: 404 });
}
