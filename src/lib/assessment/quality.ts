import type { PronunciationAssessment } from "@/lib/types";

export class AudioQualityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioQualityError";
  }
}

export function validateAssessmentQuality(input: {
  assessment: PronunciationAssessment;
  duration: number;
  minimumDuration?: number;
}) {
  const minimumDuration = input.minimumDuration ?? 5;
  const { assessment, duration } = input;
  const omittedWords = assessment.words.filter((word) => word.errorType === "Omission");
  const omissionRate = assessment.words.length
    ? omittedWords.length / assessment.words.length
    : 1;

  if (duration < minimumDuration) {
    throw new AudioQualityError(
      `録音が短すぎます。${minimumDuration}秒以上録音してから、もう一度提出してください。`,
    );
  }

  if (!assessment.words.length) {
    throw new AudioQualityError(
      "音声を十分に認識できませんでした。マイク入力と音量を確認して、もう一度録音してください。",
    );
  }

  if (
    assessment.pronunciationScore <= 5 &&
    assessment.completenessScore <= 5 &&
    omissionRate >= 0.85
  ) {
    throw new AudioQualityError(
      "読み上げ音声がほとんど検出できませんでした。教材文を声に出して録音してください。",
    );
  }
}
