// app/_layout.tsx

import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import {
  Stack,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import TrackPlayer from "react-native-track-player";
import { StatusBar, View, ActivityIndicator } from "react-native";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { store, initializeLibrary } from "@/store/library";
import { playbackService } from "@/constants/playbackService";
import { MusicPlayerProvider } from "@/components/MusicPlayerContext";
import { LyricsProvider } from "@/hooks/useLyricsContext";
import { GlobalUIStateProvider } from "@/contexts/GlobalUIStateContext";
import FloatingPlayer from "@/components/FloatingPlayer";
import { UpdateModal } from "@/components/UpdateModal";
import { MessageModal } from "@/components/MessageModal";

SplashScreen.preventAutoHideAsync();
TrackPlayer.registerPlaybackService(() => playbackService);

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

const queryClient = new QueryClient();

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color="#D4AF37" />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    Meriva: require("../assets/fonts/Meriva.ttf"),
  });

  const [libraryReady, setLibraryReady] = useState(false);
  const navigationState = useRootNavigationState();
  const segments = useSegments();

  const isPlayerScreen = segments.includes("(player)");

  // Initialize app library (NO NAVIGATION HERE)
  useEffect(() => {
    async function prepare() {
      try {
        await initializeLibrary();
      } catch (error) {
        console.warn("Library initialization failed:", error);
      } finally {
        setLibraryReady(true);
      }
    }

    prepare();
  }, []);

  // Hide splash only after everything AND navigation mounted
  useEffect(() => {
    if (fontsLoaded && libraryReady && navigationState?.key) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, libraryReady, navigationState]);

  // IMPORTANT:
  // We ALWAYS render Stack on first render.
  // We do NOT block it.
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MusicPlayerProvider>
          <LyricsProvider>
            <GlobalUIStateProvider>
              <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <ThemeProvider value={DarkTheme}>
                    <StatusBar
                      barStyle="light-content"
                      backgroundColor="transparent"
                      translucent
                    />

                    <View style={{ flex: 1, backgroundColor: "#000" }}>
                      {/* Navigator MUST mount immediately */}
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          contentStyle: { backgroundColor: "#000" },
                        }}
                      >
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen
                          name="(player)"
                          options={{
                            presentation: "transparentModal",
                            animation: "slide_from_bottom",
                            contentStyle: {
                              backgroundColor: "transparent",
                            },
                          }}
                        />
                        <Stack.Screen name="(modals)/addToPlaylist" />
                        <Stack.Screen name="(modals)/comments" />
                        <Stack.Screen name="(modals)/equalizer" />
                        <Stack.Screen name="(modals)/deletePlaylist" />
                        <Stack.Screen name="(modals)/queue" />
                        <Stack.Screen name="(modals)/premium" />
                        <Stack.Screen name="(modals)/related" />
                        <Stack.Screen name="(modals)/lyrics" />
                        <Stack.Screen name="(modals)/menu" />
                        <Stack.Screen name="+not-found" />
                      </Stack>

                      {!isPlayerScreen && (
                        <View
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            zIndex: 1000,
                          }}
                        >
                          <FloatingPlayer />
                        </View>
                      )}

                      {/* Optional loading overlay */}
                      {(!fontsLoaded || !libraryReady) && <LoadingScreen />}
                    </View>

                    <UpdateModal />
                    <MessageModal />
                  </ThemeProvider>
                </GestureHandlerRootView>
              </SafeAreaProvider>
            </GlobalUIStateProvider>
          </LyricsProvider>
        </MusicPlayerProvider>
      </Provider>
    </QueryClientProvider>
  );
}
