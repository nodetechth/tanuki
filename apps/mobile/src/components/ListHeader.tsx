import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

type ListHeaderProps = {
  activeCategory: string;
  categories: string[];
  favoriteFirst: boolean;
  onCategoryChange: (category: string) => void;
  onToggleFavoriteFirst: () => void;
  title: string;
};

export function ListHeader({
  activeCategory,
  categories,
  favoriteFirst,
  onCategoryChange,
  onToggleFavoriteFirst,
  title,
}: ListHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: favoriteFirst }}
            onPress={onToggleFavoriteFirst}
            style={[styles.iconButton, favoriteFirst ? styles.iconButtonActive : null]}
          >
            <Text style={[styles.iconText, favoriteFirst ? styles.iconTextActive : null]}>♡</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.iconButton}>
            <Text style={styles.iconText}>⚙</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.categoryRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {categories.map((category) => {
          const isActive = category === activeCategory;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={category}
              onPress={() => onCategoryChange(category)}
              style={[styles.categoryButton, isActive ? styles.categoryButtonActive : null]}
            >
              <Text style={[styles.categoryText, isActive ? styles.categoryTextActive : null]}>
                {category}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  categoryButton: {
    borderBottomColor: "transparent",
    borderBottomWidth: 3,
    minHeight: 44,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  categoryButtonActive: {
    borderBottomColor: colors.blue,
  },
  categoryRow: {
    gap: 12,
    paddingTop: 18,
  },
  categoryText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "900",
  },
  categoryTextActive: {
    color: colors.text,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginHorizontal: -18,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  iconButtonActive: {
    backgroundColor: "#fff3f3",
    borderColor: "#ffc9c9",
  },
  iconText: {
    color: colors.muted,
    fontSize: 23,
    fontWeight: "900",
  },
  iconTextActive: {
    color: "#ff4b4b",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
