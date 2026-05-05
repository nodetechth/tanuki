import { hasAzureSpeechEnv } from "@/lib/env";
import type { PronunciationAssessment } from "@/lib/types";

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function demoAssessment(referenceText: string, duration: number): PronunciationAssessment {
  const words = referenceText.replace(/[.,]/g, "").split(/\s+/).filter(Boolean);
  const expectedDuration = Math.max(18, words.length * 0.55);
  const pacePenalty = Math.min(14, Math.abs(duration - expectedDuration) * 1.1);
  const base = 86 - pacePenalty;

  return {
    accuracyScore: clampScore(base + 2),
    fluencyScore: clampScore(base - 4),
    completenessScore: clampScore(92 - Math.max(0, expectedDuration - duration) * 0.8),
    pronunciationScore: clampScore(base),
    words: words.map((word, index) => ({
      word,
      accuracyScore: clampScore(base + ((index % 5) - 2) * 3),
      errorType: index % 7 === 0 ? "Mispronunciation" : undefined,
    })),
    rawJson: {
      mode: "demo",
      note: "AZURE_SPEECH_KEY / AZURE_SPEECH_REGION が未設定のためデモ評価です。",
    },
  };
}

type AzureWord = {
  Word?: string;
  PronunciationAssessment?: {
    AccuracyScore?: number;
    ErrorType?: string;
  };
  Phonemes?: Array<{
    Phoneme?: string;
    PronunciationAssessment?: {
      AccuracyScore?: number;
    };
  }>;
};

type AzureRawJson = {
  NBest?: Array<{
    Words?: AzureWord[];
  }>;
};

function parseAzureWords(rawJson: unknown) {
  const raw = rawJson as AzureRawJson;
  const words = raw.NBest?.[0]?.Words ?? [];

  return words.map((word) => ({
    word: word.Word ?? "",
    accuracyScore: clampScore(word.PronunciationAssessment?.AccuracyScore ?? 0),
    errorType: word.PronunciationAssessment?.ErrorType,
    phonemes: word.Phonemes?.map((phoneme) => ({
      phoneme: phoneme.Phoneme ?? "",
      accuracyScore: clampScore(
        phoneme.PronunciationAssessment?.AccuracyScore ?? 0,
      ),
    })).filter((phoneme) => phoneme.phoneme),
  })).filter((word) => word.word);
}

export async function assessPronunciation(input: {
  audioUrl: string;
  referenceText: string;
  duration: number;
}): Promise<PronunciationAssessment> {
  if (!hasAzureSpeechEnv() || !input.audioUrl.startsWith("http")) {
    return demoAssessment(input.referenceText, input.duration);
  }

  const sdk = await import("microsoft-cognitiveservices-speech-sdk");
  const audioResponse = await fetch(input.audioUrl);
  if (!audioResponse.ok) {
    throw new Error("Failed to fetch uploaded audio for Azure assessment");
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY!,
    process.env.AZURE_SPEECH_REGION!,
  );
  speechConfig.speechRecognitionLanguage = "en-US";

  const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
    input.referenceText,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    true,
  );

  const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBuffer);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  pronunciationConfig.applyTo(recognizer);

  const result = await new Promise<InstanceType<typeof sdk.SpeechRecognitionResult>>(
    (resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (speechResult) => {
          recognizer.close();
          resolve(speechResult);
        },
        (error) => {
          recognizer.close();
          reject(new Error(String(error)));
        },
      );
    },
  );

  const assessment = sdk.PronunciationAssessmentResult.fromResult(result);
  const rawJson = result.properties.getProperty(
    sdk.PropertyId.SpeechServiceResponse_JsonResult,
  );
  const parsedRawJson = rawJson ? JSON.parse(rawJson) : assessment;

  return {
    accuracyScore: clampScore(assessment.accuracyScore),
    fluencyScore: clampScore(assessment.fluencyScore),
    completenessScore: clampScore(assessment.completenessScore),
    pronunciationScore: clampScore(assessment.pronunciationScore),
    words: parseAzureWords(parsedRawJson),
    rawJson: parsedRawJson,
  };
}
