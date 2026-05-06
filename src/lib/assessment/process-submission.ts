import { validateAssessmentQuality } from "@/lib/assessment/quality";
import { assessPronunciation } from "@/lib/assessment/pronunciation";
import { markFreeSubmissionUsed } from "@/lib/billing";
import { generateFeedback } from "@/lib/feedback/generate";
import { addImprovementComparison } from "@/lib/feedback/improvements";
import { getPracticeSourceFromSubmission } from "@/lib/practice-sources";
import { createAudioReadUrl } from "@/lib/storage/r2";
import {
  getSubmission,
  listUserSubmissions,
  markListeningShadowingCompleted,
  saveFeedback,
  updateSubmission,
} from "@/lib/submission-store";
import type { SubmissionWithFeedback } from "@/lib/types";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processSubmissionAssessment(input: {
  submissionId: string;
  authenticatedUserId: string;
  tutorId?: string;
}): Promise<SubmissionWithFeedback> {
  const submission = await getSubmission(input.submissionId);

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.userId !== input.authenticatedUserId) {
    throw new Error("Forbidden");
  }

  const practiceSource = getPracticeSourceFromSubmission(submission);
  if (!practiceSource) {
    throw new Error("Practice source not found");
  }

  if (submission.status === "completed" && submission.feedback) {
    return submission;
  }

  try {
    await updateSubmission(submission.id, {
      status: "azure_processing",
      retryCount: submission.retryCount + 1,
      errorMessage: null,
    });
    await wait(650);

    const audioUrl =
      (await createAudioReadUrl(submission.r2ObjectKey)) ?? submission.audioUrl;

    const assessment = await assessPronunciation({
      audioUrl,
      referenceText: practiceSource.scriptText,
      duration: submission.duration,
    });

    await updateSubmission(submission.id, {
      status: "azure_processing",
      azureRawJson: assessment.rawJson,
    });
    validateAssessmentQuality({
      assessment,
      duration: submission.duration,
    });

    await updateSubmission(submission.id, {
      status: "llm_processing",
    });
    await wait(650);

    const previousSubmissions = await listUserSubmissions(submission.userId, 50, {
      includeTest: submission.isTest,
    });
    const previousSubmission =
      previousSubmissions.find(
        (item) =>
          item.id !== submission.id &&
          item.sourceType === submission.sourceType &&
          item.sourceId === submission.sourceId &&
          item.status === "completed" &&
          item.isTest === submission.isTest &&
          Boolean(item.feedback),
      ) ?? null;

    const generatedFeedback = await generateFeedback({
      material: practiceSource,
      assessment,
      tutorId: input.tutorId ?? submission.tutorId,
    });
    const feedback = addImprovementComparison({
      feedback: generatedFeedback,
      assessment,
      previousSubmission,
    });
    await saveFeedback(submission.id, feedback);
    await updateSubmission(submission.id, {
      status: "completed",
      llmRawJson: feedback.rawJson,
    });
    if (!submission.isTest) {
      await markFreeSubmissionUsed(submission.userId);
      await markListeningShadowingCompleted({
        userId: submission.userId,
        sourceType: submission.sourceType,
        sourceId: submission.sourceId,
        submissionId: submission.id,
      });
    }

    const completed = await getSubmission(submission.id);
    if (!completed) {
      throw new Error("Completed submission not found");
    }

    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment failed";
    await updateSubmission(submission.id, {
      status: "failed",
      errorMessage: message,
    });
    throw new Error(message);
  }
}
