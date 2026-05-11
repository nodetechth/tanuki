import { appConfig } from "../config";
import type { Article } from "../types";

type ApiArticle = {
  id: string;
  contentType: Article["contentType"];
  category: string;
  levelLabel: string;
  title: string;
  description: string;
  readTimeMinutes: number;
  wpm: number | null;
  date: string;
  liked?: boolean;
};

type ArticlesResponse = {
  articles?: ApiArticle[];
  error?: string;
};

export async function fetchArticles(): Promise<Article[]> {
  const response = await fetch(`${appConfig.appUrl}/api/listening/articles`);
  const payload = (await response.json()) as ArticlesResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "記事一覧を取得できませんでした。");
  }

  return (payload.articles ?? []).map(articleFromApi);
}

function articleFromApi(article: ApiArticle): Article {
  return {
    id: article.id,
    contentType: article.contentType,
    title: article.title,
    description: article.description,
    category: article.category,
    level: article.levelLabel,
    duration: `${article.readTimeMinutes || 1}分`,
    date: article.date,
    isFavorite: article.liked,
    wpm: article.wpm ?? undefined,
  };
}
