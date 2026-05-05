import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeWordQuery } from "@/lib/word-dictionary/search";

const postSchema = z.object({
  word: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  const word = normalizeWordQuery(parsed.data.word);
  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, word });
  }

  const userId = await getRequestUserId(request);
  const { error } = await supabase.from("word_requests").insert({
    user_id: userId,
    query: word,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, word });
}
