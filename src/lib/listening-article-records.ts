import type {
  ListeningAccent,
  ListeningArticle,
  ListeningContentType,
  ListeningLevel,
  ListeningSentence,
} from "@/lib/listening-articles";

export type ListeningArticleRow = {
  id: string;
  content_type: ListeningContentType;
  category: string;
  level: ListeningLevel;
  level_label: string;
  title: string;
  description: string;
  body: unknown;
  key_words: unknown;
  read_time_minutes: number;
  word_count: number;
  wpm: number;
  audio_url: string | null;
  audio_sources?: Partial<Record<ListeningAccent, string | null>> | null;
  published_at: string;
};

export function listeningArticleFromRow(row: ListeningArticleRow): ListeningArticle {
  return {
    id: row.id,
    contentType: row.content_type,
    category: row.category,
    level: row.level,
    levelLabel: row.level_label,
    date: formatArticleDate(row.published_at),
    title: row.title,
    description: row.description,
    readTimeMinutes: Number(row.read_time_minutes) || 1,
    wordCount: Number(row.word_count) || 0,
    wpm: Number(row.wpm) || 120,
    liked: false,
    audioUrl: row.audio_url,
    audioSources: isRecord(row.audio_sources) ? row.audio_sources : undefined,
    paragraphs: parseParagraphs(row.body),
    keyWords: Array.isArray(row.key_words) ? row.key_words.map(String) : [],
  };
}

function parseParagraphs(value: unknown): ListeningArticle["paragraphs"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const paragraph = isRecord(item) ? item : {};
    return {
      en: String(paragraph.en ?? ""),
      ja: String(paragraph.ja ?? ""),
      sentences: Array.isArray(paragraph.sentences)
        ? paragraph.sentences.map((sentence, sentenceIndex) =>
            parseSentence(sentence, index, sentenceIndex),
          )
        : undefined,
    };
  });
}

function parseSentence(
  value: unknown,
  paragraphIndex: number,
  sentenceIndex: number,
): ListeningSentence {
  const sentence = isRecord(value) ? value : {};
  return {
    id: String(sentence.id ?? `p${paragraphIndex + 1}-s${sentenceIndex + 1}`),
    en: String(sentence.en ?? ""),
    ja: String(sentence.ja ?? ""),
    start: numberOrNull(sentence.start),
    end: numberOrNull(sentence.end),
    timings: isRecord(sentence.timings)
      ? {
          us: parseTiming(sentence.timings.us),
          uk: parseTiming(sentence.timings.uk),
        }
      : undefined,
  };
}

function parseTiming(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    start: numberOrNull(value.start),
    end: numberOrNull(value.end),
  };
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatArticleDate(value: string) {
  return value ? value.replaceAll("-", ".") : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
