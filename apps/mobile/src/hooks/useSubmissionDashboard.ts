import { useEffect, useState } from "react";

import {
  fetchMySubmissions,
  type MobileSubmission,
  type SubmissionSummary,
} from "../api/submissions";

type SubmissionDashboardState = {
  error: string | null;
  loading: boolean;
  submissions: MobileSubmission[];
  summary: SubmissionSummary;
};

const emptySummary: SubmissionSummary = {
  totalCount: 0,
  weekCount: 0,
  weekStart: "",
};

export function useSubmissionDashboard(accessToken: string | null | undefined) {
  const [state, setState] = useState<SubmissionDashboardState>({
    error: null,
    loading: Boolean(accessToken),
    submissions: [],
    summary: emptySummary,
  });

  useEffect(() => {
    let cancelled = false;

    if (!accessToken) {
      setState({
        error: null,
        loading: false,
        submissions: [],
        summary: emptySummary,
      });
      return () => {
        cancelled = true;
      };
    }

    const token = accessToken;

    async function loadDashboard() {
      setState((current) => ({ ...current, error: null, loading: true }));
      try {
        const data = await fetchMySubmissions(token);
        if (!cancelled) {
          setState({
            error: null,
            loading: false,
            submissions: data.submissions,
            summary: data.summary,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            error: error instanceof Error ? error.message : "添削履歴を取得できませんでした。",
            loading: false,
            submissions: [],
            summary: emptySummary,
          });
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return state;
}
