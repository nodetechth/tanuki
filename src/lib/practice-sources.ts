import { listeningArticles } from "@/lib/listening-articles";
import type { ListeningArticle } from "@/lib/listening-articles";
import { materials } from "@/lib/materials";
import type { Material, Submission } from "@/lib/types";

export type PracticeSourceType = "material" | "listening_article";

export type PracticeSource = Material & {
  sourceType: PracticeSourceType;
  sourceId: string;
  wpm: number;
  readTimeMinutes: number | null;
  description: string;
};

function estimateMaterialWpm(material: Material) {
  const match = material.wpmRange.match(/\d+/g);
  if (!match?.length) {
    return 120;
  }

  const numbers = match.map(Number);
  return Math.round(numbers.reduce((sum, item) => sum + item, 0) / numbers.length);
}

export function materialToPracticeSource(material: Material): PracticeSource {
  return {
    ...material,
    sourceType: "material",
    sourceId: material.id,
    wpm: estimateMaterialWpm(material),
    readTimeMinutes: null,
    description: material.wpmDescription,
  };
}

export function listeningArticleToPracticeSource(
  articleId: string,
): PracticeSource | null {
  const article = listeningArticles.find((item) => item.id === articleId);
  if (!article) {
    return null;
  }

  return listeningArticleToPracticeSourceFromArticle(article);
}

export function listeningArticleToPracticeSourceFromArticle(
  article: ListeningArticle,
): PracticeSource {
  const articleWpm = article.wpm ?? 120;
  return {
    id: article.id,
    sourceType: "listening_article",
    sourceId: article.id,
    level: article.level,
    levelLabel: article.levelLabel,
    wpmRange: `WPM ${articleWpm}`,
    wpmDescription: `${articleWpm} WPM / ${article.readTimeMinutes}分`,
    category: article.category,
    title: article.title,
    scriptText: article.paragraphs.map((paragraph) => paragraph.en).join("\n\n"),
    audioUrl: article.audioUrl,
    duration: Math.max(30, article.readTimeMinutes * 60),
    accent: "US",
    focus: ["内容語の強弱", "文の区切り", "自然なリズム"],
    wpm: articleWpm,
    readTimeMinutes: article.readTimeMinutes,
    description: article.description,
  };
}

export function getPracticeSource(
  sourceType: PracticeSourceType,
  sourceId: string,
): PracticeSource | null {
  if (sourceType === "listening_article") {
    return listeningArticleToPracticeSource(sourceId);
  }

  const material = materials.find((item) => item.id === sourceId);
  return material ? materialToPracticeSource(material) : null;
}

export function getPracticeSourceFromSubmission(
  submission: Pick<Submission, "materialId" | "sourceType" | "sourceId">,
): PracticeSource | null {
  return getPracticeSource(submission.sourceType, submission.sourceId) ??
    getPracticeSource("material", submission.materialId);
}
