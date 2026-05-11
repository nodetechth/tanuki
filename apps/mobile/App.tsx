import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

import { BottomTabs } from "./src/components/BottomTabs";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ListeningScreen } from "./src/screens/ListeningScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { ShadowingScreen } from "./src/screens/ShadowingScreen";
import { colors } from "./src/theme";
import type { TabId } from "./src/types";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("home");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        {activeTab === "home" ? <HomeScreen /> : null}
        {activeTab === "shadowing" ? <ShadowingScreen /> : null}
        {activeTab === "listening" ? <ListeningScreen /> : null}
        {activeTab === "search" ? <SearchScreen /> : null}
        <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.appBackground,
    flex: 1,
  },
  shell: {
    flex: 1,
  },
});
