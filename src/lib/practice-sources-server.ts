import {
  listeningArticleFromRow,
  type ListeningArticleRow,
} from "@/lib/listening-article-records";
import {
  getPracticeSource,
  listeningArticleToPracticeSourceFromArticle,
} from "@/lib/practice-sources";
import type { PracticeSource, PracticeSourceType } from "@/lib/practice-sources";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Submission } from "@/lib/types";

export async function getPracticeSourceServer(
  sourceType: PracticeSourceType,
  sourceId: string,
): Promise<PracticeSource | null> {
  if (sourceType !== "listening_article") {
    return getPracticeSource(sourceType, sourceId);
  }

  const dbArticle = await getDbListeningArticleSource(sourceId);
  return dbArticle ?? getPracticeSource(sourceType, sourceId);
}

export async function getPracticeSourceFromSubmissionServer(
  submission: Pick<Submission, "materialId" | "sourceType" | "sourceId">,
): Promise<PracticeSource | null> {
  return (
    (await getPracticeSourceServer(submission.sourceType, submission.sourceId)) ??
    getPracticeSource("material", submission.materialId)
  );
}

async function getDbListeningArticleSource(articleId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
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
        "read_time_minutes",
        "word_count",
        "wpm",
        "audio_url",
        "audio_sources",
        "published_at",
      ].join(","),
    )
    .eq("id", articleId)
    .maybeSingle<ListeningArticleRow>();

  if (error || !data) {
    return null;
  }

  return listeningArticleToPracticeSourceFromArticle(listeningArticleFromRow(data));
}
