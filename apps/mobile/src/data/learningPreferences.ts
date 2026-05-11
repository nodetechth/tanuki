import type { LearningLevel, LearningPurpose } from "../types";

export const learningLevels: Array<{
  description: string;
  id: LearningLevel;
  label: string;
}> = [
  { id: "beginner", label: "初級", description: "A2〜B1 / TOEIC 400〜600" },
  { id: "intermediate", label: "中級", description: "B1〜B2 / TOEIC 600〜800" },
  { id: "advanced", label: "上級", description: "B2〜C1 / TOEIC 800〜" },
];

export const learningPurposes: Array<{
  description: string;
  id: LearningPurpose;
  label: string;
}> = [
  { id: "casual", label: "カジュアル", description: "友人・家族・日常シーン" },
  { id: "business", label: "ビジネス", description: "会議・交渉・プレゼン" },
  { id: "toeic", label: "試験", description: "TOEIC / 資格出題傾向に沿った文体" },
];
