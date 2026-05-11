import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type TabId = "home" | "shadowing" | "listening" | "search";

type FeatureCard = {
  label: string;
  value: string;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "shadowing", label: "Shadowing" },
  { id: "listening", label: "Listening" },
  { id: "search", label: "Search" },
];

const screenCards: Record<TabId, FeatureCard[]> = {
  home: [
    { label: "今日の状態", value: "進捗と添削履歴を表示" },
    { label: "次の導線", value: "新しく練習する" },
  ],
  shadowing: [
    { label: "教材", value: "30秒前後のシャドーイング" },
    { label: "録音", value: "添削提出と結果通知" },
  ],
  listening: [
    { label: "教材", value: "2-3分のリスニング記事" },
    { label: "音声", value: "US/UK切替と速度調整" },
  ],
  search: [
    { label: "単語検索", value: "見出し語・活用形候補" },
    { label: "復習", value: "保存単語とフラッシュカード" },
  ],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const title = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.label ?? "Tanuki",
    [activeTab],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>tanuki</Text>
            <Text style={styles.caption}>Native migration starter</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MVP</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.screenTitle}>{title}</Text>
          <Text style={styles.lead}>
            Web版で固めたUIと仕様を、録音・音声再生・通知・オフライン保存に強いネイティブUIへ移していくための初期画面です。
          </Text>

          <View style={styles.cardStack}>
            {screenCards[activeTab].map((card) => (
              <View key={card.label} style={styles.card}>
                <Text style={styles.cardLabel}>{card.label}</Text>
                <Text style={styles.cardValue}>{card.value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#edf4fb",
    flex: 1,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 18,
  },
  logo: {
    color: "#17202f",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
  },
  caption: {
    color: "#667386",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#4d94df",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  content: {
    paddingBottom: 116,
  },
  screenTitle: {
    color: "#17202f",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 0,
  },
  lead: {
    color: "#667386",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 25,
    marginTop: 12,
  },
  cardStack: {
    gap: 12,
    marginTop: 22,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe6f2",
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  cardLabel: {
    color: "#4d94df",
    fontSize: 13,
    fontWeight: "900",
  },
  cardValue: {
    color: "#17202f",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 28,
    marginTop: 8,
  },
  tabBar: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderColor: "#dbe6f2",
    borderRadius: 28,
    borderWidth: 1,
    bottom: 24,
    flexDirection: "row",
    gap: 6,
    left: 18,
    padding: 8,
    position: "absolute",
    right: 18,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 22,
    flex: 1,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  tabButtonActive: {
    backgroundColor: "#4d94df",
  },
  tabLabel: {
    color: "#667386",
    fontSize: 12,
    fontWeight: "900",
  },
  tabLabelActive: {
    color: "#ffffff",
  },
});
