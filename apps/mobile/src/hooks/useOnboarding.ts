import { useCallback, useEffect, useState } from "react";

import { completeUserOnboarding, fetchUserProfile } from "../api/userProfile";
import { hasSupabaseConfig } from "../lib/supabase";
import type { LearningLevel, LearningPurpose, UserProfile } from "../types";

type OnboardingDraft = {
  englishLevel: LearningLevel | null;
  learningPurpose: LearningPurpose | null;
};

type OnboardingState = {
  completed: boolean;
  draft: OnboardingDraft;
  error: string | null;
  loading: boolean;
  profile: UserProfile | null;
  setEnglishLevel: (level: LearningLevel) => void;
  setLearningPurpose: (purpose: LearningPurpose) => void;
  submit: () => Promise<void>;
};

const initialDraft: OnboardingDraft = {
  englishLevel: null,
  learningPurpose: null,
};

export function useOnboarding(user: { email?: string | null; id: string } | null): OnboardingState {
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (user?.id && hasSupabaseConfig) {
          const nextProfile = await fetchUserProfile(user.id);
          if (isMounted) {
            setProfile(nextProfile);
          }
        } else if (isMounted) {
          setProfile(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "オンボーディング情報を読み込めませんでした。");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const updateDraft = useCallback((nextDraft: Partial<OnboardingDraft>) => {
    setDraft((current) => ({
      ...current,
      ...nextDraft,
    }));
  }, []);

  const submit = useCallback(async () => {
    if (!user?.id) {
      setError("メール認証が完了すると学習設定を保存できます。");
      return;
    }
    if (!draft.englishLevel || !draft.learningPurpose) {
      setError("レベルと用途を選択してください。");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const nextProfile = await completeUserOnboarding({
        email: user.email ?? null,
        englishLevel: draft.englishLevel,
        learningPurpose: draft.learningPurpose,
        userId: user.id,
      });
      setProfile(nextProfile);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "学習設定を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }, [draft.englishLevel, draft.learningPurpose, user]);

  const completed = Boolean(profile?.onboardingCompletedAt);

  return {
    completed,
    draft,
    error,
    loading: loading || saving,
    profile,
    setEnglishLevel: useCallback((englishLevel: LearningLevel) => updateDraft({ englishLevel }), [updateDraft]),
    setLearningPurpose: useCallback((learningPurpose: LearningPurpose) => updateDraft({ learningPurpose }), [updateDraft]),
    submit,
  };
}
