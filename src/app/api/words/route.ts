import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findSampleWord, resolveWordLookup } from "@/lib/word-dictionary/search";
import type { WordLookupCandidate } from "@/lib/word-dictionary/search";
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

function definitionPreview(entry: WordEntry) {
  return entry.definitions
    .map((definition) => definition.definition_jp.replace(/[。.]$/u, ""))
    .filter(Boolean)
    .slice(0, 2)
    .join("、");
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

async function getWord(word: string) {
  return (await getDbWord(word)) ?? findSampleWord(word);
}

async function buildAvailableCandidate(candidate: WordLookupCandidate) {
  const word = await getWord(candidate.headword);
  if (!word) {
    return null;
  }

  return {
    ...candidate,
    definitionPreview: definitionPreview(word),
    word,
  };
}

export async function GET(request: NextRequest) {
  const lookup = resolveWordLookup(request.nextUrl.searchParams.get("word") ?? "");
  const selectedHeadword = request.nextUrl.searchParams.get("headword");
  const selectedRelation = request.nextUrl.searchParams.get("relation");

  if (!lookup.query) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  if (selectedHeadword) {
    const candidate =
      lookup.candidates.find(
        (item) =>
          item.headword === selectedHeadword &&
          (!selectedRelation || item.relation === selectedRelation),
      ) ??
      lookup.candidates.find((item) => item.headword === selectedHeadword);
    const word = await getWord(selectedHeadword);

    if (word && candidate) {
      return NextResponse.json({
        status: "single",
        word,
        source: "selected",
        lookup: candidate.relation === "exact" ? null : candidate,
      });
    }
  }

  const candidates = (
    await Promise.all(lookup.candidates.map((candidate) => buildAvailableCandidate(candidate)))
  ).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  if (!candidates.length) {
    return NextResponse.json(
      { status: "missing", query: lookup.query, error: "Word not found" },
      { status: 404 },
    );
  }

  if (candidates.length === 1) {
    const [candidate] = candidates;
    return NextResponse.json({
      status: "single",
      word: candidate.word,
      source: candidate.relation === "exact" ? "direct" : "lookup",
      lookup: candidate.relation === "exact" ? null : {
        input: candidate.input,
        headword: candidate.headword,
        relation: candidate.relation,
        label: candidate.label,
      },
    });
  }

  return NextResponse.json({
    status: "candidates",
    query: lookup.query,
    candidates: candidates.map((candidate) => ({
      input: candidate.input,
      headword: candidate.headword,
      relation: candidate.relation,
      label: candidate.label,
      definitionPreview: candidate.definitionPreview,
    })),
  });
}
