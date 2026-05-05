import type {
  FeedbackResult,
  PronunciationAssessment,
  SubmissionWithFeedback,
} from "@/lib/types";

function normalizeWord(value: string) {
  return value.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function withImprovementRawJson(
  rawJson: unknown,
  improvementPoints: FeedbackResult["improvementPoints"],
) {
  if (typeof rawJson === "object" && rawJson !== null && !Array.isArray(rawJson)) {
    return {
      ...(rawJson as Record<string, unknown>),
      improvementPoints,
    };
  }

  return {
    response: rawJson,
    improvementPoints,
  };
}

export function addImprovementComparison(input: {
  feedback: FeedbackResult;
  assessment: PronunciationAssessment;
  previousSubmission: SubmissionWithFeedback | null;
}): FeedbackResult {
  const previousProblemWords = input.previousSubmission?.feedback?.problemWords ?? [];

  if (!previousProblemWords.length) {
    return {
      ...input.feedback,
      improvementPoints: [],
      rawJson: withImprovementRawJson(input.feedback.rawJson, []),
    };
  }

  const currentWords = new Map(
    input.assessment.words.map((word) => [normalizeWord(word.word), word]),
  );
  const seen = new Set<string>();
  const improvementPoints = previousProblemWords
    .map((previous) => {
      const key = normalizeWord(previous.word);
      const current = currentWords.get(key);
      if (!key || seen.has(key) || !current) {
        return null;
      }
      seen.add(key);

      const improved =
        current.accuracyScore >= 82 &&
        current.errorType !== "Omission" &&
        current.errorType !== "Mispronunciation";

      if (!improved) {
        return null;
      }

      return {
        word: previous.word,
        message: "前回より良くなっています",
        previousReason: previous.reason,
        currentScore: Math.round(current.accuracyScore),
      };
    })
    .filter((item): item is FeedbackResult["improvementPoints"][number] => Boolean(item))
    .slice(0, 4);

  return {
    ...input.feedback,
    improvementPoints,
    rawJson: withImprovementRawJson(input.feedback.rawJson, improvementPoints),
  };
}
