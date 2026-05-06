export type MaterialLevel = "beginner" | "intermediate" | "advanced";

export type SubmissionStatus =
  | "uploaded"
  | "azure_processing"
  | "llm_processing"
  | "completed"
  | "failed";

export type Material = {
  id: string;
  level: MaterialLevel;
  levelLabel: string;
  wpmRange: string;
  wpmDescription: string;
  category: string;
  title: string;
  scriptText: string;
  audioUrl: string | null;
  duration: number;
  accent: string;
  focus: string[];
};

export type SubmissionSourceType = "material" | "listening_article";

export type PronunciationAssessment = {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronunciationScore: number;
  words: Array<{
    word: string;
    accuracyScore: number;
    errorType?: string;
    phonemes?: Array<{
      phoneme: string;
      accuracyScore: number;
    }>;
  }>;
  rawJson: unknown;
};

export type FeedbackResult = {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  goodPoints: string[];
  improvementPoints: Array<{
    word: string;
    message: string;
    previousReason: string;
    currentScore: number;
  }>;
  developmentPoints: string[];
  problemWords: Array<{
    word: string;
    reason: string;
  }>;
  nextFocus: string;
  aiComment: string;
  rawJson: unknown;
};

export type Submission = {
  id: string;
  userId: string;
  materialId: string;
  sourceType: SubmissionSourceType;
  sourceId: string;
  tutorId: string;
  accessType: "free" | "subscriber" | "admin_test";
  isTest: boolean;
  testLabel: string | null;
  audioUrl: string;
  r2ObjectKey: string;
  duration: number;
  fileSize: number;
  status: SubmissionStatus;
  errorMessage: string | null;
  retryCount: number;
  azureRawJson: unknown;
  llmRawJson: unknown;
  createdAt: string;
};

export type SubmissionWithFeedback = Submission & {
  feedback: FeedbackResult | null;
};
