import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser, isAdminUser } from "@/lib/auth";
import { getBillingState } from "@/lib/billing";
import { getPracticeSourceServer } from "@/lib/practice-sources-server";
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
  isTest: z.coerce.boolean().default(false),
  testLabel: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    }
    const authenticatedUserId = user.id;
    const isAdmin = await isAdminUser(user);

    const formData = await request.formData();
    const requestedIsTest = formData.get("isTest");
    const billing = await getBillingState(authenticatedUserId, { isAdmin });
    const isTestSubmission =
      requestedIsTest === "true" || requestedIsTest === "1" || requestedIsTest === "on";

    if (isTestSubmission && !isAdmin) {
      return NextResponse.json({ error: "Admin test mode is not allowed." }, { status: 403 });
    }

    if (!isTestSubmission && !billing.canSubmit) {
      return NextResponse.json(
        {
          error: billing.denialReason,
          billing,
        },
        { status: 402 },
      );
    }

    const tutorId = formData.get("tutorId");
    const sourceType = formData.get("sourceType");
    const sourceId = formData.get("sourceId");
    const materialId = formData.get("materialId");
    const testLabel = formData.get("testLabel");
    const parsed = postSchema.parse({
      materialId: typeof materialId === "string" ? materialId : undefined,
      sourceType: typeof sourceType === "string" ? sourceType : undefined,
      sourceId: typeof sourceId === "string" ? sourceId : undefined,
      tutorId: typeof tutorId === "string" ? tutorId : undefined,
      duration: formData.get("duration"),
      isTest: isTestSubmission,
      testLabel: typeof testLabel === "string" ? testLabel : undefined,
    });
    const resolvedSourceId = parsed.sourceId ?? parsed.materialId;
    const source = resolvedSourceId
      ? await getPracticeSourceServer(parsed.sourceType, resolvedSourceId)
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
      accessType: parsed.isTest ? "admin_test" : billing.isSubscriber ? "subscriber" : "free",
      isTest: parsed.isTest,
      testLabel: parsed.isTest ? parsed.testLabel ?? "admin-test" : null,
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
  const user = await getRequestUser(request);
  const authenticatedUserId = user?.id ?? null;

  if (scope === "mine") {
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const includeTest = request.nextUrl.searchParams.get("includeTest") === "true";
    if (includeTest && !(await isAdminUser(user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const submissions = await listUserSubmissions(authenticatedUserId, includeTest ? 50 : 20, {
      includeTest,
    });
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
