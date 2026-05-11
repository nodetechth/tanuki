import { useEffect, useMemo, useState } from "react";

import { fetchArticles } from "../api/articles";
import { listeningArticles, shadowingArticles } from "../data/mock";
import type { Article } from "../types";

type ArticleState = {
  articles: Article[];
  isFallback: boolean;
  loading: boolean;
};

const fallbackArticles = [...shadowingArticles, ...listeningArticles];

export function useArticles(contentType: Article["contentType"]) {
  const [state, setState] = useState<ArticleState>({
    articles: fallbackArticles,
    isFallback: true,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadArticles() {
      try {
        const articles = await fetchArticles();
        if (!cancelled) {
          setState({
            articles: articles.length ? articles : fallbackArticles,
            isFallback: !articles.length,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            articles: fallbackArticles,
            isFallback: true,
            loading: false,
          });
        }
      }
    }

    void loadArticles();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      articles: state.articles.filter((article) => article.contentType === contentType),
      isFallback: state.isFallback,
      loading: state.loading,
    }),
    [contentType, state],
  );
}
