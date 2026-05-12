import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScrollView } from "../components/AppScrollView";
import { learningLevels, learningPurposes } from "../data/learningPreferences";
import type { AuthState } from "../hooks/useAuth";
import type { useOnboarding } from "../hooks/useOnboarding";
import { colors } from "../theme";

type OnboardingScreenProps = {
  auth: AuthState;
  onboarding: ReturnType<typeof useOnboarding>;
};

export function OnboardingScreen({ auth, onboarding }: OnboardingScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const canSubmitAuth = Boolean(email.trim() && password.length >= 6) && !auth.loading;
  const canComplete = Boolean(auth.user && onboarding.draft.englishLevel && onboarding.draft.learningPurpose);
  const isSignedIn = Boolean(auth.user);

  return (
    <AppScrollView>
      <View style={styles.hero}>
        <Text style={styles.logo}>tanuki</Text>
        <Text style={styles.title}>{isSignedIn ? "学習設定をしましょう" : "ログイン / 登録"}</Text>
        <Text style={styles.lead}>
          {isSignedIn
            ? "選択した用途・レベルであなたに合わせた英語の例文を作成します。"
            : "メールアドレスを登録すると、レベルに合わせた学習や単語が保存できます。"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.step}>{isSignedIn ? "認証完了" : "1 / 3"}</Text>
        <Text style={styles.cardTitle}>メールアドレスでログイン</Text>
        {auth.user ? (
          <View>
            <Text style={styles.cardLead}>ログインが完了しました。</Text>
            <Text style={styles.signedInEmail}>{auth.user.email}</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.cardLead}>
              メールアドレスとパスワードで登録またはログインできます。
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="email"
              keyboardType="email-address"
              onBlur={() => setEmailTouched(true)}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.mutedSoft}
              style={styles.emailInput}
              value={email}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onBlur={() => setPasswordTouched(true)}
              onChangeText={setPassword}
              placeholder="パスワード（6文字以上）"
              placeholderTextColor={colors.mutedSoft}
              secureTextEntry
              style={styles.emailInput}
              value={password}
            />
            <View style={styles.authButtonRow}>
              <Pressable
                disabled={!canSubmitAuth}
                onPress={() => {
                  setEmailTouched(true);
                  setPasswordTouched(true);
                  void auth.signUpWithPassword(email, password);
                }}
                style={[styles.secondaryAuthButton, !canSubmitAuth ? styles.disabledButton : null]}
              >
                <Text style={styles.secondaryAuthButtonText}>登録</Text>
              </Pressable>
              <Pressable
                disabled={!canSubmitAuth}
                onPress={() => {
                  setEmailTouched(true);
                  setPasswordTouched(true);
                  void auth.signInWithPassword(email, password);
                }}
                style={[styles.primaryAuthButton, !canSubmitAuth ? styles.disabledButton : null]}
              >
                <Text style={styles.primaryButtonText}>
                  {auth.loading ? "処理中..." : "ログイン"}
                </Text>
              </Pressable>
            </View>
            {emailTouched && !email.trim() ? (
              <Text style={styles.errorText}>メールアドレスを入力してください。</Text>
            ) : null}
            {passwordTouched && password.length > 0 && password.length < 6 ? (
              <Text style={styles.errorText}>パスワードは6文字以上で入力してください。</Text>
            ) : null}
          </View>
        )}
        {auth.message ? <Text style={styles.messageText}>{auth.message}</Text> : null}
        {auth.error ? <Text style={styles.errorText}>{auth.error}</Text> : null}
        {onboarding.error ? <Text style={styles.errorText}>{onboarding.error}</Text> : null}
      </View>

      {auth.user ? (
        <>
          <View style={styles.card}>
            <Text style={styles.step}>2 / 3</Text>
            <Text style={styles.cardTitle}>レベル</Text>
            <Text style={styles.cardLead}>今の英語力に近いものを選んでください。</Text>
            <View style={styles.optionList}>
              {learningLevels.map((level) => (
                <Pressable
                  key={level.id}
                  onPress={() => onboarding.setEnglishLevel(level.id)}
                  style={[
                    styles.option,
                    onboarding.draft.englishLevel === level.id ? styles.optionSelected : null,
                  ]}
                >
                  <View>
                    <Text style={styles.optionLabel}>{level.label}</Text>
                    <Text style={styles.optionDescription}>{level.description}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.step}>3 / 3</Text>
            <Text style={styles.cardTitle}>用途</Text>
            <Text style={styles.cardLead}>よく使いたい場面に近いものを選んでください。</Text>
            <View style={styles.optionList}>
              {learningPurposes.map((purpose) => (
                <Pressable
                  key={purpose.id}
                  onPress={() => onboarding.setLearningPurpose(purpose.id)}
                  style={[
                    styles.option,
                    onboarding.draft.learningPurpose === purpose.id ? styles.optionSelected : null,
                  ]}
                >
                  <View>
                    <Text style={styles.optionLabel}>{purpose.label}</Text>
                    <Text style={styles.optionDescription}>{purpose.description}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <Pressable
              disabled={!canComplete || onboarding.loading}
              onPress={() => {
                void onboarding.submit();
              }}
              style={[styles.primaryButton, !canComplete || onboarding.loading ? styles.disabledButton : null]}
            >
              <Text style={styles.primaryButtonText}>
                {onboarding.loading ? "保存中..." : "Tanukiを始める"}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </AppScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  cardLead: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 6,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.5,
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
  errorText: {
    color: "#b84c61",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 12,
  },
  hero: {
    paddingBottom: 6,
  },
  lead: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 25,
    marginTop: 10,
  },
  logo: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  messageText: {
    color: colors.blueStrong,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 12,
  },
  option: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  optionDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 3,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  optionList: {
    gap: 10,
    marginTop: 14,
  },
  optionSelected: {
    backgroundColor: colors.surfaceBlue,
    borderColor: colors.blue,
  },
  authButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  primaryAuthButton: {
    alignItems: "center",
    backgroundColor: colors.blue,
    borderRadius: 18,
    flex: 1,
    justifyContent: "center",
    minHeight: 56,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.blue,
    borderRadius: 18,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 56,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  secondaryAuthButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 56,
  },
  secondaryAuthButtonText: {
    color: colors.blueStrong,
    fontSize: 17,
    fontWeight: "900",
  },
  signedInEmail: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 8,
  },
  step: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  title: {
    color: colors.text,
    fontSize: 33,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 41,
    marginTop: 10,
  },
});
