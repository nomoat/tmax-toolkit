import "../theme.css";

import * as React from "react";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import * as WebBrowser from "expo-web-browser";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { FpsMonitor } from "@/tmux-mobile/fps-monitor";
import { TmuxMobileAuthProvider } from "@/tmux-mobile/auth";
import { lightTheme as theme } from "@/theme";

WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 3000,
    },
  },
});

async function loadFonts() {
  await Font.loadAsync({
    Lato_400Regular: require("@expo-google-fonts/lato/400Regular/Lato_400Regular.ttf"),
    Lato_700Bold: require("@expo-google-fonts/lato/700Bold/Lato_700Bold.ttf"),
    JetBrainsMono_400Regular: require("@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf"),
    NotoSansSC_400Regular: require("@expo-google-fonts/noto-sans-sc/400Regular/NotoSansSC_400Regular.ttf"),
    NotoSansSC_700Bold: require("@expo-google-fonts/noto-sans-sc/700Bold/NotoSansSC_700Bold.ttf"),
  });
}

export default function RootLayout() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    loadFonts()
      .catch((error) => {
        console.warn("Font loading failed", error);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <TmuxMobileAuthProvider>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <KeyboardProvider>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
              <StatusBar style={theme.dark ? "light" : "dark"} />
              <Stack screenOptions={{ headerShown: false }} />
              <FpsMonitor />
            </GestureHandlerRootView>
          </KeyboardProvider>
        </SafeAreaProvider>
      </TmuxMobileAuthProvider>
    </QueryClientProvider>
  );
}
