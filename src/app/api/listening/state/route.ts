import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const postSchema = z.object({
  articleId: z.string().min(1),
  readCompleted: z.boolean().optional(),
  favorite: z.boolean().optional(),
  saved: z.boolean().optional(),
  offlineSaved: z.boolean().optional(),
  preferredAccent: z.enum(["us", "uk"]).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ states: [] });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ states: [] });
  }

  const { data, error } = await supabase
    .from("user_listening_articles")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    states: (data ?? []).map((row) => ({
      articleId: row.article_id,
      favorite: Boolean(row.is_favorite),
      readCompletedAt: row.read_completed_at ?? row.completed_at ?? null,
      shadowingCompletedAt: row.shadowing_completed_at ?? null,
      savedAt: row.saved_at ?? null,
      offlineSavedAt: row.offline_saved_at ?? null,
      preferredAccent: row.preferred_accent ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    user_id: userId,
    article_id: parsed.data.articleId,
    last_opened_at: now,
    updated_at: now,
  };

  if (parsed.data.readCompleted) {
    payload.read_completed_at = now;
    payload.completed_at = now;
  }

  if (parsed.data.favorite !== undefined) {
    payload.is_favorite = parsed.data.favorite;
  }

  if (parsed.data.saved !== undefined) {
    payload.saved_at = parsed.data.saved ? now : null;
  }

  if (parsed.data.offlineSaved !== undefined) {
    payload.offline_saved_at = parsed.data.offlineSaved ? now : null;
  }

  if (parsed.data.preferredAccent !== undefined) {
    payload.preferred_accent = parsed.data.preferredAccent;
  }

  const { error } = await supabase.from("user_listening_articles").upsert(payload);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
