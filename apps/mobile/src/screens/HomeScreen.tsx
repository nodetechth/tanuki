import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScrollView } from "../components/AppScrollView";
import { SectionCard } from "../components/SectionCard";
import { useAuth } from "../hooks/useAuth";
import { colors } from "../theme";

export function HomeScreen() {
  const [email, setEmail] = useState("");
  const auth = useAuth();

  return (
    <AppScrollView>
      <View style={styles.hero}>
        <Text style={styles.logo}>tanuki</Text>
        <Text style={styles.title}>今日の英語学習</Text>
        <Text style={styles.lead}>進捗、添削履歴、次にやる練習をここで確認します。</Text>
      </View>

      <SectionCard eyebrow="Account" title="ログイン">
        {!auth.configured ? (
          <Text style={styles.authNotice}>
            Supabase環境変数を設定すると、ネイティブ版でもメールリンクログインを確認できます。
          </Text>
        ) : auth.user ? (
          <View>
            <Text style={styles.authLabel}>ログイン中</Text>
            <Text style={styles.authEmail}>{auth.user.email}</Text>
            <Pressable onPress={auth.signOut} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>ログアウト</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={styles.authNotice}>
              メールアドレスを入力すると、登録とログインに使えるリンクを送ります。
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.mutedSoft}
              style={styles.emailInput}
              value={email}
            />
            <Pressable
              disabled={auth.loading}
              onPress={() => {
                void auth.sendMagicLink(email);
              }}
              style={[styles.primaryButton, auth.loading ? styles.disabledButton : null]}
            >
              <Text style={styles.primaryButtonText}>
                {auth.loading ? "送信中..." : "登録 or ログイン"}
              </Text>
            </Pressable>
          </View>
        )}
        {auth.message ? <Text style={styles.authMessage}>{auth.message}</Text> : null}
        {auth.error ? <Text style={styles.authError}>{auth.error}</Text> : null}
      </SectionCard>

      <SectionCard eyebrow="Progress" title="今週の練習">
        <View style={styles.stats}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>総添削回数</Text>
            <Text style={styles.statValue}>12回</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>今週</Text>
            <Text style={styles.statValue}>3回</Text>
          </View>
        </View>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>新しく練習する</Text>
        </Pressable>
      </SectionCard>

      <SectionCard eyebrow="History" title="直近の添削履歴">
        {["Morning Coffee", "Asking for Directions", "A Quick Support Call"].map((item, index) => (
          <View key={item} style={styles.historyRow}>
            <View>
              <Text style={styles.historyTitle}>{item}</Text>
              <Text style={styles.historyMeta}>05/{10 - index} 20:5{index}</Text>
            </View>
            <Text style={styles.score}>総合 {90 - index * 3}</Text>
          </View>
        ))}
      </SectionCard>
    </AppScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: 16,
  },
  historyMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  historyRow: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  authEmail: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },
  authError: {
    color: "#b84c61",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 12,
  },
  authLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  authMessage: {
    color: colors.blueStrong,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 12,
  },
  authNotice: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  disabledButton: {
    opacity: 0.55,
  },
  emailInput: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 14,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  historyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  lead: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 23,
    marginTop: 8,
  },
  logo: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.blue,
    borderRadius: 18,
    marginTop: 16,
    minHeight: 56,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  score: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 52,
  },
  secondaryButtonText: {
    color: colors.blueStrong,
    fontSize: 16,
    fontWeight: "900",
  },
  statBox: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  statValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 10,
  },
});
