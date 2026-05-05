import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUserId } from "@/lib/auth";
import { getBillingState } from "@/lib/billing";
import { getPracticeSource } from "@/lib/practice-sources";
import {
  createSubmission,
  getSubmission,
  listUserSubmissions,
} from "@/lib/submission-store";
import { storeAudio } from "@/lib/storage/r2";

const postSchema = z.object({
  materialId: z.string().optional(),
  sourceType: z.enum(["material", "listening_article"]).default("material"),
  sourceId: z.string().optional(),
  tutorId: z.string().optional(),
  duration: z.coerce.number().nonnegative().default(0),
});

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserId = await getRequestUserId(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    }

    const billing = await getBillingState(authenticatedUserId);
    if (!billing.canSubmit) {
      return NextResponse.json(
        {
          error: billing.denialReason,
          billing,
        },
        { status: 402 },
      );
    }

    const formData = await request.formData();
    const tutorId = formData.get("tutorId");
    const sourceType = formData.get("sourceType");
    const sourceId = formData.get("sourceId");
    const materialId = formData.get("materialId");
    const parsed = postSchema.parse({
      materialId: typeof materialId === "string" ? materialId : undefined,
      sourceType: typeof sourceType === "string" ? sourceType : undefined,
      sourceId: typeof sourceId === "string" ? sourceId : undefined,
      tutorId: typeof tutorId === "string" ? tutorId : undefined,
      duration: formData.get("duration"),
    });
    const resolvedSourceId = parsed.sourceId ?? parsed.materialId;
    const source = resolvedSourceId
      ? getPracticeSource(parsed.sourceType, resolvedSourceId)
      : null;
    const audio = formData.get("audio");

    if (!source) {
      return NextResponse.json({ error: "Unknown practice source" }, { status: 400 });
    }

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const stored = await storeAudio(audio, authenticatedUserId);
    const submission = await createSubmission({
      userId: authenticatedUserId,
      materialId: source.sourceType === "material" ? source.sourceId : null,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      tutorId: parsed.tutorId,
      accessType: billing.isSubscriber ? "subscriber" : "free",
      audioUrl: stored.url,
      r2ObjectKey: stored.key,
      duration: parsed.duration,
      fileSize: audio.size,
    });

    return NextResponse.json({ submission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Submission failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const scope = request.nextUrl.searchParams.get("scope");
  const authenticatedUserId = await getRequestUserId(request);

  if (scope === "mine") {
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const submissions = await listUserSubmissions(authenticatedUserId);
    return NextResponse.json({ submissions });
  }

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const submission = await getSubmission(id);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (!authenticatedUserId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (submission.userId !== authenticatedUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ submission });
}
