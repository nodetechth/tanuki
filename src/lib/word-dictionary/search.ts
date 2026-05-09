import lemmatize from "wink-lemmatizer";
import sampleWords from "./sample-words.json";
import type { WordEntry, WordLevel, WordPurpose } from "./types";

const words = sampleWords as WordEntry[];

export type WordLookupRelation =
  | "exact"
  | "past_tense"
  | "past_participle"
  | "present_participle"
  | "third_person_singular"
  | "plural"
  | "comparative"
  | "superlative"
  | "inflected";

export type WordLookupCandidate = {
  input: string;
  headword: string;
  relation: WordLookupRelation;
  label: string;
};

const knownVerbRelations: Record<string, WordLookupRelation> = {
  saw: "past_tense",
  seen: "past_participle",
  left: "past_tense",
  went: "past_tense",
  gone: "past_participle",
  was: "past_tense",
  were: "past_tense",
  did: "past_tense",
  done: "past_participle",
  had: "past_tense",
  made: "past_tense",
  bought: "past_tense",
  brought: "past_tense",
  thought: "past_tense",
};

const irregularLookupMap: Record<string, { headword: string; relation: WordLookupRelation }[]> = {
  went: [{ headword: "go", relation: "past_tense" }],
  gone: [{ headword: "go", relation: "past_participle" }],
  children: [{ headword: "child", relation: "plural" }],
  better: [{ headword: "good", relation: "comparative" }],
  best: [{ headword: "good", relation: "superlative" }],
  worse: [{ headword: "bad", relation: "comparative" }],
  worst: [{ headword: "bad", relation: "superlative" }],
};

export function normalizeWordQuery(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z'\-\s]/g, "").replace(/\s+/g, " ");
}

function relationLabel(headword: string, relation: WordLookupRelation) {
  switch (relation) {
    case "exact":
      return headword;
    case "past_tense":
      return `${headword} の過去形`;
    case "past_participle":
      return `${headword} の過去分詞`;
    case "present_participle":
      return `${headword} の現在分詞`;
    case "third_person_singular":
      return `${headword} の三人称単数現在形`;
    case "plural":
      return `${headword} の複数形`;
    case "comparative":
      return `${headword} の比較級`;
    case "superlative":
      return `${headword} の最上級`;
    default:
      return `${headword} の活用形`;
  }
}

function inferVerbRelation(input: string): WordLookupRelation {
  if (knownVerbRelations[input]) {
    return knownVerbRelations[input];
  }
  if (input.endsWith("ing")) {
    return "present_participle";
  }
  if (input.endsWith("s")) {
    return "third_person_singular";
  }
  if (input.endsWith("ed")) {
    return "past_tense";
  }
  return "inflected";
}

function inferAdjectiveRelation(input: string): WordLookupRelation {
  if (input === "better" || input === "worse" || input.endsWith("er")) {
    return "comparative";
  }
  if (input === "best" || input === "worst" || input.endsWith("est")) {
    return "superlative";
  }
  return "inflected";
}

function pushUniqueCandidate(
  candidates: WordLookupCandidate[],
  candidate: WordLookupCandidate,
) {
  const key = `${candidate.headword}:${candidate.relation}`;
  if (candidates.some((item) => `${item.headword}:${item.relation}` === key)) {
    return;
  }
  candidates.push(candidate);
}

export function resolveWordLookup(value: string) {
  const query = normalizeWordQuery(value);
  const candidates: WordLookupCandidate[] = [];

  if (!query || query.includes(" ")) {
    return { query, candidates };
  }

  pushUniqueCandidate(candidates, {
    input: query,
    headword: query,
    relation: "exact",
    label: relationLabel(query, "exact"),
  });

  for (const mapped of irregularLookupMap[query] ?? []) {
    pushUniqueCandidate(candidates, {
      input: query,
      headword: mapped.headword,
      relation: mapped.relation,
      label: relationLabel(mapped.headword, mapped.relation),
    });
  }

  const verbHeadword = lemmatize.verb(query);
  if (verbHeadword && verbHeadword !== query) {
    const relation = inferVerbRelation(query);
    pushUniqueCandidate(candidates, {
      input: query,
      headword: verbHeadword,
      relation,
      label: relationLabel(verbHeadword, relation),
    });
  }

  const nounHeadword = lemmatize.noun(query);
  if (nounHeadword && nounHeadword !== query) {
    pushUniqueCandidate(candidates, {
      input: query,
      headword: nounHeadword,
      relation: "plural",
      label: relationLabel(nounHeadword, "plural"),
    });
  }

  const adjectiveHeadword = lemmatize.adjective(query);
  if (adjectiveHeadword && adjectiveHeadword !== query) {
    const relation = inferAdjectiveRelation(query);
    pushUniqueCandidate(candidates, {
      input: query,
      headword: adjectiveHeadword,
      relation,
      label: relationLabel(adjectiveHeadword, relation),
    });
  }

  return { query, candidates };
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
