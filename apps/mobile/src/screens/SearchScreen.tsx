import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScrollView } from "../components/AppScrollView";
import { SectionCard } from "../components/SectionCard";
import { wordFolders } from "../data/mock";
import { colors } from "../theme";

export function SearchScreen() {
  return (
    <AppScrollView>
      <Text style={styles.title}>Search</Text>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          placeholder="単語を検索"
          placeholderTextColor={colors.mutedSoft}
          style={styles.searchInput}
        />
        <Pressable style={styles.searchButton}>
          <Text style={styles.searchButtonText}>検索</Text>
        </Pressable>
      </View>

      <SectionCard eyebrow="Folders" title="単語フォルダ">
        <View style={styles.folderGrid}>
          {wordFolders.map((folder) => (
            <View key={folder.id} style={styles.folderCard}>
              <Text style={styles.folderIcon}>□</Text>
              <Text style={styles.folderName}>{folder.name}</Text>
              <Text style={styles.folderCount}>{folder.count} words</Text>
            </View>
          ))}
        </View>
      </SectionCard>
    </AppScrollView>
  );
}

const styles = StyleSheet.create({
  folderCard: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    width: "48%",
  },
  folderCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 14,
  },
  folderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  folderIcon: {
    color: colors.blue,
    fontSize: 28,
    fontWeight: "900",
  },
  folderName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 23,
    marginTop: 18,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
    minHeight: 68,
    paddingHorizontal: 16,
  },
  searchButton: {
    alignItems: "center",
    backgroundColor: colors.blue,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  searchButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  searchIcon: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 18,
  },
});
