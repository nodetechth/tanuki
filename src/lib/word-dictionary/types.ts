export type WordLevel = "beginner" | "intermediate" | "advanced";
export type WordPurpose = "casual" | "business" | "toeic";

export type WordDefinition = {
  part_of_speech: string;
  definition_en: string;
  definition_jp: string;
};

export type WordExample = {
  sentence_en: string;
  sentence_jp: string;
};

export type WordEntry = {
  word: string;
  phonetic_jp: string;
  stress: string;
  definitions: WordDefinition[];
  usage_notes: string;
  synonyms: string[];
  examples: Record<WordLevel, Record<WordPurpose, WordExample>>;
};
