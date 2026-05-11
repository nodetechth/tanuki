import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

type ArticleListStatusProps = {
  isFallback: boolean;
  loading: boolean;
};

export function ArticleListStatus({ isFallback, loading }: ArticleListStatusProps) {
  if (loading) {
    return (
      <View style={styles.status}>
        <Text style={styles.text}>記事を読み込み中...</Text>
      </View>
    );
  }

  if (!isFallback) {
    return null;
  }

  return (
    <View style={styles.status}>
      <Text style={styles.text}>APIに接続できない場合はサンプル記事を表示します。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    backgroundColor: colors.surfaceBlue,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginHorizontal: -18,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  text: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
});
