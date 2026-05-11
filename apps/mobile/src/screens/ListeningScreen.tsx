import { useMemo, useState } from "react";
import { View } from "react-native";

import { AppScrollView } from "../components/AppScrollView";
import { ArticleList } from "../components/ArticleList";
import { ListHeader } from "../components/ListHeader";
import { categories, listeningArticles } from "../data/mock";

export function ListeningScreen() {
  const [category, setCategory] = useState("ALL");
  const [favoriteFirst, setFavoriteFirst] = useState(false);
  const articles = useMemo(() => {
    const filtered =
      category === "ALL"
        ? listeningArticles
        : listeningArticles.filter((article) => article.category === category);
    if (!favoriteFirst) return filtered;
    return [...filtered].sort((a, b) => Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite)));
  }, [category, favoriteFirst]);

  return (
    <AppScrollView>
      <ListHeader
        activeCategory={category}
        categories={categories}
        favoriteFirst={favoriteFirst}
        onCategoryChange={setCategory}
        onToggleFavoriteFirst={() => setFavoriteFirst((value) => !value)}
        title="Listening"
      />
      <View>
        <ArticleList articles={articles} icon="♫" />
      </View>
    </AppScrollView>
  );
}
