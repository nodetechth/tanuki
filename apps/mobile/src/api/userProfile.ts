import { supabase } from "../lib/supabase";
import type { LearningLevel, LearningPurpose, UserProfile } from "../types";

type UserProfileRow = {
  email: string | null;
  english_level: LearningLevel;
  learning_purpose: LearningPurpose;
  onboarding_completed_at: string | null;
  user_id: string;
};

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id,email,english_level,learning_purpose,onboarding_completed_at")
    .eq("user_id", userId)
    .maybeSingle<UserProfileRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapUserProfile(data) : null;
}

export async function completeUserOnboarding(input: {
  email: string | null;
  englishLevel: LearningLevel;
  learningPurpose: LearningPurpose;
  userId: string;
}): Promise<UserProfile> {
  if (!supabase) {
    throw new Error("Supabase環境変数が未設定です。");
  }

  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        email: input.email,
        english_level: input.englishLevel,
        learning_purpose: input.learningPurpose,
        onboarding_completed_at: completedAt,
        updated_at: completedAt,
        user_id: input.userId,
      },
      { onConflict: "user_id" },
    )
    .select("user_id,email,english_level,learning_purpose,onboarding_completed_at")
    .single<UserProfileRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapUserProfile(data);
}

function mapUserProfile(row: UserProfileRow): UserProfile {
  return {
    email: row.email,
    englishLevel: row.english_level,
    learningPurpose: row.learning_purpose,
    onboardingCompletedAt: row.onboarding_completed_at,
    userId: row.user_id,
  };
}
