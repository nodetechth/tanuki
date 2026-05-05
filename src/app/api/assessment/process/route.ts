import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processSubmissionAssessment } from "@/lib/assessment/process-submission";
import { getRequestUserId } from "@/lib/auth";
import { getPracticeSourceFromSubmission } from "@/lib/practice-sources";
import { getSubmission } from "@/lib/submission-store";

const schema = z.object({
  submissionId: z.string().min(1),
  tutorId: z.string().optional(),
  background: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
  }

  const authenticatedUserId = await getRequestUserId(request);
  const submission = await getSubmission(parsed.data.submissionId);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (!authenticatedUserId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (submission.userId !== authenticatedUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const practiceSource = getPracticeSourceFromSubmission(submission);
  if (!practiceSource) {
    return NextResponse.json({ error: "Practice source not found" }, { status: 400 });
  }

  if (submission.status === "completed" && submission.feedback) {
    return NextResponse.json({ submission });
  }

  if (parsed.data.background) {
    after(async () => {
      try {
        await processSubmissionAssessment({
          submissionId: submission.id,
          authenticatedUserId,
          tutorId: parsed.data.tutorId,
        });
      } catch (error) {
        console.error("Background assessment failed", error);
      }
    });

    return NextResponse.json({
      submission,
      queued: true,
      message: "Assessment queued",
    });
  }

  try {
    const completed = await processSubmissionAssessment({
      submissionId: submission.id,
      authenticatedUserId,
      tutorId: parsed.data.tutorId,
    });
    return NextResponse.json({ submission: completed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment failed";
    const status = message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
