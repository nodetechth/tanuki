import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  FeedbackResult,
  Submission,
  SubmissionStatus,
  SubmissionWithFeedback,
} from "@/lib/types";

type DemoStore = {
  submissions: Map<string, Submission>;
  feedback: Map<string, FeedbackResult>;
};

const globalForStore = globalThis as typeof globalThis & {
  tanukiDemoStore?: DemoStore;
};

function demoStore() {
  if (!globalForStore.tanukiDemoStore) {
    globalForStore.tanukiDemoStore = {
      submissions: new Map(),
      feedback: new Map(),
    };
  }

  return globalForStore.tanukiDemoStore;
}

function fromSupabaseSubmission(row: Record<string, unknown>): Submission {
  const accessType =
    row.access_type === "admin_test"
      ? "admin_test"
      : row.access_type === "subscriber"
        ? "subscriber"
        : "free";

  return {
    id: String(row.id),
    userId: String(row.user_id),
    materialId: String(row.material_id ?? row.source_id ?? ""),
    sourceType: row.source_type === "listening_article" ? "listening_article" : "material",
    sourceId: String(row.source_id ?? row.material_id ?? ""),
    tutorId: String(row.tutor_id ?? "a_san"),
    accessType,
    isTest: Boolean(row.is_test),
    testLabel: row.test_label ? String(row.test_label) : null,
    audioUrl: String(row.audio_url ?? ""),
    r2ObjectKey: String(row.r2_object_key ?? ""),
    duration: Number(row.duration ?? 0),
    fileSize: Number(row.file_size ?? 0),
    status: row.status as SubmissionStatus,
    errorMessage: row.error_message ? String(row.error_message) : null,
    retryCount: Number(row.retry_count ?? 0),
    azureRawJson: row.azure_raw_json ?? null,
    llmRawJson: row.llm_raw_json ?? null,
    createdAt: String(row.created_at),
  };
}

function fromSupabaseFeedback(row: Record<string, unknown> | null): FeedbackResult | null {
  if (!row) {
    return null;
  }
  const rawJson = row.llm_raw_json ?? null;
  const rawJsonRecord =
    typeof rawJson === "object" && rawJson !== null && !Array.isArray(rawJson)
      ? (rawJson as Record<string, unknown>)
      : null;
  const rawImprovementPoints = rawJsonRecord?.improvementPoints;

  return {
    accuracyScore: Number(row.accuracy_score ?? 0),
    fluencyScore: Number(row.fluency_score ?? 0),
    completenessScore: Number(row.completeness_score ?? 0),
    goodPoints: Array.isArray(row.good_points) ? row.good_points.map(String) : [],
    improvementPoints: Array.isArray(rawImprovementPoints)
      ? rawImprovementPoints
          .map((item) => {
            if (typeof item === "object" && item !== null) {
              const value = item as Record<string, unknown>;
              return {
                word: String(value.word ?? ""),
                message: String(value.message ?? "前回より良くなっています"),
                previousReason: String(value.previousReason ?? ""),
                currentScore: Number(value.currentScore ?? 0),
              };
            }
            return null;
          })
          .filter(
            (item): item is FeedbackResult["improvementPoints"][number] =>
              Boolean(item?.word),
          )
      : [],
    developmentPoints: Array.isArray(row.development_points)
      ? row.development_points.map(String)
      : [],
    problemWords: Array.isArray(row.problem_words)
      ? row.problem_words
          .map((item) => {
            if (typeof item === "object" && item !== null) {
              const value = item as Record<string, unknown>;
              return {
                word: String(value.word ?? ""),
                reason: String(value.reason ?? ""),
              };
            }
            return null;
          })
          .filter((item): item is { word: string; reason: string } => Boolean(item?.word))
      : [],
    nextFocus: String(row.next_focus ?? ""),
    aiComment: String(row.ai_comment ?? ""),
    rawJson,
  };
}

export async function createSubmission(input: {
  userId: string;
  materialId?: string | null;
  sourceType?: Submission["sourceType"];
  sourceId: string;
  tutorId?: string;
  accessType: Submission["accessType"];
  isTest?: boolean;
  testLabel?: string | null;
  audioUrl: string;
  r2ObjectKey: string;
  duration: number;
  fileSize: number;
}) {
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const insertPayload = {
      user_id: input.userId,
      material_id: input.materialId ?? null,
      source_type: input.sourceType ?? "material",
      source_id: input.sourceId,
      tutor_id: input.tutorId ?? "a_san",
      access_type: input.accessType,
      is_test: Boolean(input.isTest),
      test_label: input.testLabel ?? null,
      audio_url: input.audioUrl,
      r2_object_key: input.r2ObjectKey,
      duration: input.duration,
      file_size: input.fileSize,
      status: "uploaded",
    };
    const { data, error } = await supabase
      .from("submissions")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      if (
        error.message.includes("source_type") ||
        error.message.includes("source_id") ||
        error.message.includes("tutor_id")
      ) {
        const legacyPayload: Record<string, unknown> = { ...insertPayload };
        legacyPayload.material_id = input.materialId ?? input.sourceId;
        delete legacyPayload.source_type;
        delete legacyPayload.source_id;
        delete legacyPayload.tutor_id;
        delete legacyPayload.is_test;
        delete legacyPayload.test_label;
        const { data: legacyData, error: legacyError } = await supabase
          .from("submissions")
          .insert(legacyPayload)
          .select("*")
          .single();

        if (legacyError) {
          throw new Error(legacyError.message);
        }

        return fromSupabaseSubmission(legacyData);
      }

      throw new Error(error.message);
    }

    return fromSupabaseSubmission(data);
  }

  const submission: Submission = {
    id: crypto.randomUUID(),
    userId: input.userId,
    materialId: input.materialId ?? input.sourceId,
    sourceType: input.sourceType ?? "material",
    sourceId: input.sourceId,
    tutorId: input.tutorId ?? "a_san",
    accessType: input.accessType,
    isTest: Boolean(input.isTest),
    testLabel: input.testLabel ?? null,
    audioUrl: input.audioUrl,
    r2ObjectKey: input.r2ObjectKey,
    duration: input.duration,
    fileSize: input.fileSize,
    status: "uploaded",
    errorMessage: null,
    retryCount: 0,
    azureRawJson: null,
    llmRawJson: null,
    createdAt: new Date().toISOString(),
  };

  demoStore().submissions.set(submission.id, submission);
  return submission;
}

export async function getSubmission(id: string): Promise<SubmissionWithFeedback | null> {
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("submissions")
      .select("*, feedback(*)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    const row = data as Record<string, unknown>;
    const feedbackRows = row.feedback as Record<string, unknown>[] | null;

    return {
      ...fromSupabaseSubmission(row),
      feedback: fromSupabaseFeedback(feedbackRows?.[0] ?? null),
    };
  }

  const store = demoStore();
  const submission = store.submissions.get(id);
  if (!submission) {
    return null;
  }

  return {
    ...submission,
    feedback: store.feedback.get(id) ?? null,
  };
}

export async function listUserSubmissions(
  userId: string,
  limit = 20,
  options: { includeTest?: boolean } = {},
): Promise<SubmissionWithFeedback[]> {
  const supabase = getSupabaseAdmin();

  if (supabase) {
    let query = supabase
      .from("submissions")
      .select("*, feedback(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!options.includeTest) {
      query = query.eq("is_test", false);
    }

    const { data, error } = await query;

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to load submissions");
    }

    return data.map((item) => {
      const row = item as Record<string, unknown>;
      const feedbackRows = row.feedback as Record<string, unknown>[] | null;

      return {
        ...fromSupabaseSubmission(row),
        feedback: fromSupabaseFeedback(feedbackRows?.[0] ?? null),
      };
    });
  }

  const store = demoStore();
  return Array.from(store.submissions.values())
    .filter((submission) => submission.userId === userId)
    .filter((submission) => options.includeTest || !submission.isTest)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit)
    .map((submission) => ({
      ...submission,
      feedback: store.feedback.get(submission.id) ?? null,
    }));
}

export async function getUserSubmissionSummary(
  userId: string,
  options: { includeTest?: boolean } = {},
) {
  const supabase = getSupabaseAdmin();
  const weekStart = startOfCurrentWeekJst();

  if (supabase) {
    let totalQuery = supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    let weekQuery = supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", weekStart.toISOString());

    if (!options.includeTest) {
      totalQuery = totalQuery.eq("is_test", false);
      weekQuery = weekQuery.eq("is_test", false);
    }

    const [totalResult, weekResult] = await Promise.all([totalQuery, weekQuery]);

    if (totalResult.error || weekResult.error) {
      throw new Error(totalResult.error?.message ?? weekResult.error?.message ?? "Failed to load submission summary");
    }

    return {
      totalCount: totalResult.count ?? 0,
      weekCount: weekResult.count ?? 0,
      weekStart: weekStart.toISOString(),
    };
  }

  const submissions = Array.from(demoStore().submissions.values())
    .filter((submission) => submission.userId === userId)
    .filter((submission) => options.includeTest || !submission.isTest);

  return {
    totalCount: submissions.length,
    weekCount: submissions.filter((submission) => new Date(submission.createdAt) >= weekStart).length,
    weekStart: weekStart.toISOString(),
  };
}

function startOfCurrentWeekJst() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  const diffFromMonday = day === 0 ? 6 : day - 1;
  const startJstUtcMs = Date.UTC(
    jst.getUTCFullYear(),
    jst.getUTCMonth(),
    jst.getUTCDate() - diffFromMonday,
    0,
    0,
    0,
    0,
  );
  return new Date(startJstUtcMs - 9 * 60 * 60 * 1000);
}

export async function updateSubmission(
  id: string,
  patch: Partial<
    Pick<
      Submission,
      "status" | "errorMessage" | "retryCount" | "azureRawJson" | "llmRawJson"
    >
  >,
) {
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const updatePayload: Record<string, unknown> = {};
    if (patch.status) updatePayload.status = patch.status;
    if (patch.errorMessage !== undefined) updatePayload.error_message = patch.errorMessage;
    if (patch.retryCount !== undefined) updatePayload.retry_count = patch.retryCount;
    if (patch.azureRawJson !== undefined) updatePayload.azure_raw_json = patch.azureRawJson;
    if (patch.llmRawJson !== undefined) updatePayload.llm_raw_json = patch.llmRawJson;

    const { error } = await supabase.from("submissions").update(updatePayload).eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const store = demoStore();
  const current = store.submissions.get(id);
  if (!current) {
    throw new Error("Submission not found");
  }

  store.submissions.set(id, {
    ...current,
    ...patch,
  });
}

export async function saveFeedback(submissionId: string, feedback: FeedbackResult) {
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { error } = await supabase.from("feedback").insert({
      submission_id: submissionId,
      accuracy_score: feedback.accuracyScore,
      fluency_score: feedback.fluencyScore,
      completeness_score: feedback.completenessScore,
      good_points: feedback.goodPoints,
      development_points: feedback.developmentPoints,
      problem_words: feedback.problemWords,
      next_focus: feedback.nextFocus,
      ai_comment: feedback.aiComment,
      llm_raw_json: feedback.rawJson,
    });

    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  demoStore().feedback.set(submissionId, feedback);
}

export async function markListeningShadowingCompleted(input: {
  userId: string;
  sourceType: Submission["sourceType"];
  sourceId: string;
  submissionId: string;
}) {
  if (input.sourceType !== "listening_article") {
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("user_listening_articles").upsert({
    user_id: input.userId,
    article_id: input.sourceId,
    shadowing_completed_at: new Date().toISOString(),
    last_shadowing_submission_id: input.submissionId,
    last_opened_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}
