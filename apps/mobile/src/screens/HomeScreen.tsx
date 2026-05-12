import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MobileSubmission } from "../api/submissions";
import { AppScrollView } from "../components/AppScrollView";
import { SectionCard } from "../components/SectionCard";
import { learningLevels, learningPurposes } from "../data/learningPreferences";
import type { AuthState } from "../hooks/useAuth";
import type { useOnboarding } from "../hooks/useOnboarding";
import { useSubmissionDashboard } from "../hooks/useSubmissionDashboard";
import { colors } from "../theme";

type HomeScreenProps = {
  auth: AuthState;
  onboarding: ReturnType<typeof useOnboarding>;
};

export function HomeScreen({ auth, onboarding }: HomeScreenProps) {
  const currentLevel = learningLevels.find((level) => level.id === onboarding.profile?.englishLevel);
  const currentPurpose = learningPurposes.find((purpose) => purpose.id === onboarding.profile?.learningPurpose);
  const dashboard = useSubmissionDashboard(auth.session?.access_token);

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
            Supabase環境変数を設定すると、ネイティブ版でもメールアドレスとパスワードでログインを確認できます。
          </Text>
        ) : auth.user ? (
          <View>
            <Text style={styles.authLabel}>ログイン中</Text>
            <Text style={styles.authEmail}>{auth.user.email}</Text>
            {currentLevel && currentPurpose ? (
              <Text style={styles.authNotice}>
                学習設定: {currentLevel.label} / {currentPurpose.label}
              </Text>
            ) : null}
            <Pressable onPress={auth.signOut} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>ログアウト</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={styles.authNotice}>
              オンボーディングでメールアドレスとパスワードを登録します。ログイン状態が切れた場合は、同じメールアドレスとパスワードでログインしてください。
            </Text>
          </View>
        )}
        {auth.message ? <Text style={styles.authMessage}>{auth.message}</Text> : null}
        {auth.error ? <Text style={styles.authError}>{auth.error}</Text> : null}
      </SectionCard>

      <SectionCard eyebrow="Progress" title="今週の練習">
        <View style={styles.stats}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>総添削回数</Text>
            <Text style={styles.statValue}>{dashboard.summary.totalCount}回</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>今週</Text>
            <Text style={styles.statValue}>{dashboard.summary.weekCount}回</Text>
          </View>
        </View>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>新しく練習する</Text>
        </Pressable>
      </SectionCard>

      <SectionCard eyebrow="History" title="直近の添削履歴">
        {!auth.user ? (
          <Text style={styles.authNotice}>ログインすると、直近の添削履歴を表示します。</Text>
        ) : dashboard.loading ? (
          <Text style={styles.authNotice}>読み込み中...</Text>
        ) : dashboard.error ? (
          <Text style={styles.authError}>{dashboard.error}</Text>
        ) : dashboard.submissions.length ? (
          dashboard.submissions.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <View style={styles.historyText}>
                <Text numberOfLines={1} style={styles.historyTitle}>
                  {item.sourceTitle ?? item.sourceId}
                </Text>
                <Text style={styles.historyMeta}>{formatHistoryDate(item.createdAt)}</Text>
              </View>
              <Text style={item.status === "failed" ? styles.errorScore : styles.score}>
                {item.feedback ? `総合 ${overallScore(item.feedback)}` : statusLabel(item.status)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.authNotice}>
            まだ提出履歴はありません。録音を提出するとここに追加されます。
          </Text>
        )}
      </SectionCard>
    </AppScrollView>
  );
}

function overallScore(feedback: NonNullable<MobileSubmission["feedback"]>) {
  return Math.round((feedback.accuracyScore + feedback.fluencyScore + feedback.completenessScore) / 3);
}

function statusLabel(status: MobileSubmission["status"]) {
  switch (status) {
    case "completed":
      return "完了";
    case "failed":
      return "失敗";
    case "azure_processing":
    case "llm_processing":
      return "添削中";
    case "uploaded":
    default:
      return "受付済み";
  }
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
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
  historyText: {
    flex: 1,
    paddingRight: 12,
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
    justifyContent: "center",
    marginTop: 16,
    minHeight: 56,
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
  errorScore: {
    color: "#b84c61",
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
