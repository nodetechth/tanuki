import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

import { BottomTabs } from "./src/components/BottomTabs";
import { useAuth } from "./src/hooks/useAuth";
import { useOnboarding } from "./src/hooks/useOnboarding";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ListeningScreen } from "./src/screens/ListeningScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { ShadowingScreen } from "./src/screens/ShadowingScreen";
import { colors } from "./src/theme";
import type { TabId } from "./src/types";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const auth = useAuth();
  const onboarding = useOnboarding(auth.user);
  const shouldShowOnboarding = !onboarding.loading && !onboarding.completed;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        {shouldShowOnboarding ? (
          <OnboardingScreen auth={auth} onboarding={onboarding} />
        ) : (
          <>
            {activeTab === "home" ? <HomeScreen auth={auth} onboarding={onboarding} /> : null}
            {activeTab === "shadowing" ? <ShadowingScreen /> : null}
            {activeTab === "listening" ? <ListeningScreen /> : null}
            {activeTab === "search" ? <SearchScreen /> : null}
            <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
          </>
        )}
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
