import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import type { TabId } from "../types";

const tabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "home", label: "ホーム", icon: "⌂" },
  { id: "shadowing", label: "添削", icon: "◉" },
  { id: "listening", label: "リスニング", icon: "♫" },
  { id: "search", label: "検索", icon: "⌕" },
];

type BottomTabsProps = {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
};

export function BottomTabs({ activeTab, onChange }: BottomTabsProps) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}
          >
            <Text style={[styles.tabIcon, isActive ? styles.tabLabelActive : null]}>
              {tab.icon}
            </Text>
            <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: colors.line,
    borderRadius: 28,
    borderWidth: 1,
    bottom: 24,
    flexDirection: "row",
    gap: 6,
    left: 18,
    padding: 8,
    position: "absolute",
    right: 18,
    shadowColor: "#214878",
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 22,
    flex: 1,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: colors.blue,
  },
  tabIcon: {
    color: colors.muted,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 23,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  tabLabelActive: {
    color: "#ffffff",
  },
});
