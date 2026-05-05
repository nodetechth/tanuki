import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getTutorProfile } from "@/lib/tutors";
import type { Material } from "@/lib/types";
import type { FeedbackResult, PronunciationAssessment } from "@/lib/types";

const systemPrompt =
  [
    "あなたは英語シャドーイング学習者向けの発音コーチです。",
    "日本語は自然で、学習者を責めず、次の録音で何を直すかが分かる表現にしてください。",
    "スコアが低い場合は無理に褒めず、確認できた事実と改善点を中心にしてください。",
    "毎回同じ定型文を避け、教材文・スコア・単語別エラーに合わせて言い換えてください。",
  ].join("\n");

function extractJson(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : trimmed) as {
    goodPoints?: string[];
    developmentPoints?: string[];
    problemWords?: Array<{
      word?: string;
      reason?: string;
    }>;
    nextFocus?: string;
    aiComment?: string;
  };
}

function demoFeedback(
  material: Material,
  assessment: PronunciationAssessment,
  tutorId?: string | null,
): FeedbackResult {
  const tutor = getTutorProfile(tutorId);
  const weakWords = getProblemWords(assessment)
    .slice(0, 3)
    .map((word) => ({
      word: word.word,
      reason:
        word.errorType === "Omission"
          ? "音が抜けて聞こえています"
          : `${word.word} の音があと一歩です`,
    }));
  const lowScore = isLowScore(assessment);

  return {
    accuracyScore: assessment.accuracyScore,
    fluencyScore: assessment.fluencyScore,
    completenessScore: assessment.completenessScore,
    goodPoints: lowScore
      ? [
          "録音を提出し、教材文に取り組めていることは確認できました。",
          "一部の語句は声として拾えているので、短く区切るとさらに確認しやすくなります。",
        ]
      : [
          "文全体を止めずに読もうとしている点は良いです。",
          `${material.accent}のリズムに近づけようとする流れがあります。`,
        ],
    improvementPoints: [],
    developmentPoints: [
      weakWords.length
        ? `${weakWords.map((word) => word.word).join("、")} を重点的に確認しよう。`
        : "機能語を少し弱くして、内容語を前に出すとより自然です。",
      material.focus[0],
    ],
    problemWords: weakWords,
    nextFocus: weakWords[0]
      ? `${weakWords[0].word} の音を1つだけ丁寧に録音してみよう！`
      : "内容語を1つだけ強く読むことを意識して録音してみよう！",
    aiComment: lowScore
      ? "今回は音が拾えた部分が少なめ。まずは教材文を短く区切って、最初の数語をしっかり声に出してみよう。次はもっと細かくチェックできるはずです。"
      : "文全体の流れは作れています。次は1文を2〜3ブロックに分けて、弱く読む語と強く読む語の差をつけて録音してみよう。",
    rawJson: {
      mode: "demo",
      tutor: {
        id: tutor.id,
        name: tutor.displayName,
      },
      note: "OPENAI_API_KEY / ANTHROPIC_API_KEY が未設定のためデモ添削です。",
    },
  };
}

function isLowScore(assessment: PronunciationAssessment) {
  return (
    assessment.accuracyScore < 60 ||
    assessment.fluencyScore < 60 ||
    assessment.completenessScore < 60
  );
}

function getProblemWords(assessment: PronunciationAssessment) {
  return assessment.words
    .filter(
      (word) =>
        word.errorType === "Mispronunciation" ||
        word.errorType === "Omission" ||
        word.accuracyScore < 78,
    )
    .sort((a, b) => {
      if (a.errorType === "Omission" && b.errorType !== "Omission") return -1;
      if (b.errorType === "Omission" && a.errorType !== "Omission") return 1;
      return a.accuracyScore - b.accuracyScore;
    });
}

export async function generateFeedback(input: {
  material: Material;
  assessment: PronunciationAssessment;
  tutorId?: string | null;
}): Promise<FeedbackResult> {
  const tutor = getTutorProfile(input.tutorId);
  const problemWords = getProblemWords(input.assessment).slice(0, 10);
  const lowScore = isLowScore(input.assessment);
  const tutorSystemPrompt = [systemPrompt, tutor.promptProfile.systemAddendum]
    .filter(Boolean)
    .join("\n");
  const payload = {
    script: input.material.scriptText,
    focus: input.material.focus,
    level: input.material.levelLabel,
    scores: {
      accuracy: input.assessment.accuracyScore,
      fluency: input.assessment.fluencyScore,
      completeness: input.assessment.completenessScore,
      pronunciation: input.assessment.pronunciationScore,
    },
    lowScore,
    problemWords: problemWords.map((word) => ({
      word: word.word,
      score: word.accuracyScore,
      errorType: word.errorType ?? "LowScore",
      weakPhonemes: word.phonemes
        ?.filter((phoneme) => phoneme.accuracyScore < 75)
        .slice(0, 3),
    })),
    tutor: {
      id: tutor.id,
      name: tutor.displayName,
      role: tutor.roleLabel,
    },
    coachingPolicy: tutor.promptProfile.coachingPolicy,
  };

  const userPrompt = `以下の発音評価をもとに添削してください。
JSONのみで返してください: {"goodPoints": string[], "developmentPoints": string[], "problemWords": [{"word": string, "reason": string}], "nextFocus": string, "aiComment": string}
制約:
- goodPointsは必ず2件だけ。1件につき1つの良かった点を、教材文や評価結果に基づいて具体的に書く。
- developmentPointsは必ず2件だけ。1件につき1つの気になった点を、具体的な単語名・音のつながり・口/舌/息の使い方が分かる形で書く。
- goodPoints/developmentPointsの各要素は40〜90字程度の自然な日本語にする。
${tutor.promptProfile.constraints.map((constraint) => `- ${constraint}`).join("\n")}

${JSON.stringify(payload)}`;

  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.5",
      input: [
        { role: "system", content: tutorSystemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });
    const parsed = extractJson(response.output_text);

    return {
      accuracyScore: input.assessment.accuracyScore,
      fluencyScore: input.assessment.fluencyScore,
      completenessScore: input.assessment.completenessScore,
      goodPoints: normalizeFeedbackPoints(parsed.goodPoints, fallbackGoodPoints(input.material, lowScore)),
      improvementPoints: [],
      developmentPoints: normalizeFeedbackPoints(
        parsed.developmentPoints,
        fallbackDevelopmentPoints(problemWords, input.material),
      ),
      problemWords: normalizeProblemWords(parsed.problemWords, problemWords),
      nextFocus: parsed.nextFocus ?? fallbackNextFocus(problemWords),
      aiComment: parsed.aiComment ?? "",
      rawJson: {
        tutor: {
          id: tutor.id,
          name: tutor.displayName,
        },
        response,
      },
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
      max_tokens: 900,
      system: tutorSystemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content
      .map((item) => (item.type === "text" ? item.text : ""))
      .join("");
    const parsed = extractJson(text);

    return {
      accuracyScore: input.assessment.accuracyScore,
      fluencyScore: input.assessment.fluencyScore,
      completenessScore: input.assessment.completenessScore,
      goodPoints: normalizeFeedbackPoints(parsed.goodPoints, fallbackGoodPoints(input.material, lowScore)),
      improvementPoints: [],
      developmentPoints: normalizeFeedbackPoints(
        parsed.developmentPoints,
        fallbackDevelopmentPoints(problemWords, input.material),
      ),
      problemWords: normalizeProblemWords(parsed.problemWords, problemWords),
      nextFocus: parsed.nextFocus ?? fallbackNextFocus(problemWords),
      aiComment: parsed.aiComment ?? "",
      rawJson: {
        tutor: {
          id: tutor.id,
          name: tutor.displayName,
        },
        response,
      },
    };
  }

  return demoFeedback(input.material, input.assessment, tutor.id);
}

function normalizeFeedbackPoints(
  points: string[] | undefined,
  fallbackPoints: string[],
  count = 2,
) {
  const normalized = (points ?? [])
    .map((point) => point.trim())
    .filter(Boolean);
  const unique = Array.from(new Set([...normalized, ...fallbackPoints]));
  return unique.slice(0, count);
}

function fallbackGoodPoints(material: Material, lowScore: boolean) {
  return lowScore
    ? [
        "録音を提出し、教材文に取り組めていることは確認できました。",
        "一部の語句は声として拾えているので、短く区切るとさらに確認しやすくなります。",
      ]
    : [
        "文全体を止めずに読もうとしている点は良いです。",
        `${material.accent}のリズムに近づけようとする流れがあります。`,
      ];
}

function fallbackDevelopmentPoints(
  problemWords: PronunciationAssessment["words"],
  material: Material,
) {
  const first = problemWords[0]?.word;
  const second = problemWords[1]?.word;
  return [
    first
      ? `${first} は口の形を少し大きく作り、最初の音を短くはっきり出してみよう。`
      : "内容語を少し強く、機能語を少し弱く読むと文全体の流れが自然になります。",
    second
      ? `${second} は前後の語とつなげすぎず、息を残して最後の音まで確認してみよう。`
      : material.focus[0],
  ];
}

function normalizeProblemWords(
  parsedWords: Array<{ word?: string; reason?: string }> | undefined,
  fallbackWords: PronunciationAssessment["words"],
) {
  const normalized = (parsedWords ?? [])
    .map((item) => ({
      word: String(item.word ?? "").trim(),
      reason: String(item.reason ?? "").trim(),
    }))
    .filter((item) => item.word)
    .slice(0, 4);

  if (normalized.length) {
    return normalized;
  }

  return fallbackWords.slice(0, 4).map((word) => ({
    word: word.word,
    reason:
      word.errorType === "Omission"
        ? "音が抜けて聞こえています"
        : "発音をもう少し丁寧に確認したい単語です",
  }));
}

function fallbackNextFocus(problemWords: PronunciationAssessment["words"]) {
  const firstWord = problemWords[0]?.word;
  return firstWord
    ? `${firstWord} の音を1つだけ丁寧に録音してみよう！`
    : "内容語を1つだけ強く読むことを意識して録音してみよう！";
}
