import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import type { Article } from "../types";

type ArticleListProps = {
  articles: Article[];
  icon: string;
};

export function ArticleList({ articles, icon }: ArticleListProps) {
  return (
    <View style={styles.list}>
      {articles.map((article) => (
        <Pressable key={article.id} style={styles.row}>
          <View style={styles.body}>
            <View style={styles.meta}>
              <Text style={styles.metaPill}>{article.category}</Text>
              <Text style={styles.metaPill}>{article.level}</Text>
              {article.wpm ? <Text style={styles.metaPill}>WPM {article.wpm}</Text> : null}
              <Text style={styles.metaText}>{article.duration}</Text>
            </View>
            <Text numberOfLines={2} style={styles.title}>
              {article.title}
            </Text>
            <Text numberOfLines={2} style={styles.description}>
              {article.description}
            </Text>
            <Text style={styles.date}>{article.date}</Text>
          </View>
          <View style={styles.side}>
            <View style={styles.thumbnail}>
              <Text style={styles.thumbnailIcon}>{icon}</Text>
            </View>
            {article.isFavorite ? <Text style={styles.favorite}>♥</Text> : null}
            {article.isCompleted ? <Text style={styles.completed}>済</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minWidth: 0,
  },
  completed: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
  },
  date: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 7,
  },
  favorite: {
    color: "#ff4b4b",
    fontSize: 18,
    fontWeight: "900",
  },
  list: {
    backgroundColor: colors.surface,
    marginHorizontal: -18,
  },
  meta: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  metaPill: {
    backgroundColor: "#dcecff",
    borderRadius: 999,
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  row: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 132,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  side: {
    alignItems: "center",
    gap: 8,
    width: 58,
  },
  thumbnail: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: colors.surfaceBlue,
    borderRadius: 14,
    justifyContent: "center",
    width: 58,
  },
  thumbnailIcon: {
    color: colors.blue,
    fontSize: 26,
    fontWeight: "900",
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
});
