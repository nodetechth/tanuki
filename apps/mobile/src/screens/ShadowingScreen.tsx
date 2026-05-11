import { useMemo, useState } from "react";
import { View } from "react-native";

import { AppScrollView } from "../components/AppScrollView";
import { ArticleList } from "../components/ArticleList";
import { ArticleListStatus } from "../components/ArticleListStatus";
import { ListHeader } from "../components/ListHeader";
import { categories } from "../data/mock";
import { useArticles } from "../hooks/useArticles";

export function ShadowingScreen() {
  const [category, setCategory] = useState("ALL");
  const [favoriteFirst, setFavoriteFirst] = useState(false);
  const { articles: sourceArticles, isFallback, loading } = useArticles("shadowing");
  const articles = useMemo(() => {
    const filtered =
      category === "ALL"
        ? sourceArticles
        : sourceArticles.filter((article) => article.category === category);
    if (!favoriteFirst) return filtered;
    return [...filtered].sort((a, b) => Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite)));
  }, [category, favoriteFirst, sourceArticles]);

  return (
    <AppScrollView>
      <ListHeader
        activeCategory={category}
        categories={categories}
        favoriteFirst={favoriteFirst}
        onCategoryChange={setCategory}
        onToggleFavoriteFirst={() => setFavoriteFirst((value) => !value)}
        title="Shadowing"
      />
      <ArticleListStatus isFallback={isFallback} loading={loading} />
      <View>
        <ArticleList articles={articles} icon="●" />
      </View>
    </AppScrollView>
  );
}
