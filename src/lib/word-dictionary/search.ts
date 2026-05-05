import sampleWords from "./sample-words.json";
import type { WordEntry, WordLevel, WordPurpose } from "./types";

const words = sampleWords as WordEntry[];

export type WordInflectionRelation = "past_tense" | "past_participle";

export type WordLookupNormalization = {
  input: string;
  headword: string;
  relation: WordInflectionRelation;
};

const minimalInflectionMap: Record<string, WordLookupNormalization> = {
  saw: { input: "saw", headword: "see", relation: "past_tense" },
  seen: { input: "seen", headword: "see", relation: "past_participle" },
};

export function normalizeWordQuery(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z'\-\s]/g, "").replace(/\s+/g, " ");
}

export function resolveWordLookup(value: string) {
  const normalized = normalizeWordQuery(value);
  const lookup = minimalInflectionMap[normalized] ?? null;

  return {
    query: normalized,
    headword: lookup?.headword ?? normalized,
    lookup,
  };
}

export function findSampleWord(value: string) {
  const normalized = normalizeWordQuery(value);
  return words.find((word) => word.word === normalized) ?? null;
}

export function allSampleWords() {
  return words;
}

export function getPreferredExample(
  entry: WordEntry,
  level: WordLevel,
  purpose: WordPurpose,
) {
  return (
    entry.examples[level]?.[purpose] ??
    entry.examples[level]?.business ??
    entry.examples.intermediate.business
  );
}
