import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

type SectionCardProps = {
  children: ReactNode;
  eyebrow?: string;
  title: string;
};

export function SectionCard({ children, eyebrow, title }: SectionCardProps) {
  return (
    <View style={styles.card}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 29,
  },
});
