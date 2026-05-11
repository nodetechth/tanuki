import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { spacing } from "../theme";

type AppScrollViewProps = {
  children: ReactNode;
};

export function AppScrollView({ children }: AppScrollViewProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.bottomInset,
    paddingHorizontal: spacing.pageX,
    paddingTop: 12,
  },
});
