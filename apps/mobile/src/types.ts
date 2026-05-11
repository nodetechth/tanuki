export type TabId = "home" | "shadowing" | "listening" | "search";

export type LearningLevel = "beginner" | "intermediate" | "advanced";

export type LearningPurpose = "casual" | "business" | "toeic";

export type Article = {
  id: string;
  contentType: "shadowing" | "listening";
  title: string;
  description: string;
  category: string;
  level: string;
  duration: string;
  date: string;
  isFavorite?: boolean;
  isCompleted?: boolean;
  wpm?: number;
};

export type WordFolder = {
  id: string;
  name: string;
  count: number;
};

export type UserProfile = {
  userId: string;
  email: string | null;
  englishLevel: LearningLevel;
  learningPurpose: LearningPurpose;
  onboardingCompletedAt: string | null;
};
