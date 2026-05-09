import { NextResponse } from "next/server";
import {
  listeningArticleFromRow,
  type ListeningArticleRow,
} from "@/lib/listening-article-records";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ articles: [] });
  }

  const { data, error } = await supabase
    .from("listening_articles")
    .select(
      [
        "id",
        "content_type",
        "category",
        "level",
        "level_label",
        "title",
        "description",
        "body",
        "key_words",
        "read_time_minutes",
        "word_count",
        "wpm",
        "audio_url",
        "audio_sources",
        "published_at",
      ].join(","),
    )
    .order("published_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    articles: ((data ?? []) as unknown as ListeningArticleRow[]).map(
      listeningArticleFromRow,
    ),
  });
}
