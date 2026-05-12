import { appConfig } from "../config";

export type MobileSubmission = {
  id: string;
  sourceId: string;
  sourceTitle?: string;
  status: "uploaded" | "azure_processing" | "llm_processing" | "completed" | "failed";
  createdAt: string;
  feedback: {
    accuracyScore: number;
    fluencyScore: number;
    completenessScore: number;
  } | null;
};

export type SubmissionSummary = {
  totalCount: number;
  weekCount: number;
  weekStart: string;
};

type SubmissionsResponse = {
  error?: string;
  submissions?: MobileSubmission[];
  summary?: SubmissionSummary;
};

export async function fetchMySubmissions(accessToken: string) {
  const response = await fetch(`${appConfig.appUrl}/api/submissions?scope=mine`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = (await response.json()) as SubmissionsResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "添削履歴を取得できませんでした。");
  }

  return {
    submissions: payload.submissions ?? [],
    summary: payload.summary ?? { totalCount: 0, weekCount: 0, weekStart: "" },
  };
}
