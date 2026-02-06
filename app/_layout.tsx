import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { useSetupTrackPlayer } from "@/hooks/useSetupTrackPlayer";
import { SystemBars } from "react-native-edge-to-edge";
import { useLogTrackPlayerState } from "@/hooks/useLogTrackPlayerState";
import useNotificationClickHandler from "@/hooks/useNotificationClickHandler";
import TrackPlayer from "react-native-track-player";
import { MessageModal } from "@/components/MessageModal";
import { UpdateModal } from "@/components/UpdateModal";
import { playbackService } from "@/constants/playbackService";
import { MusicPlayerProvider } from "@/components/MusicPlayerContext";
import { LyricsProvider } from "@/hooks/useLyricsContext";
import { initializeLibrary, store } from "@/store/library";
import { Provider } from "react-redux";
import { setupNotificationChannel } from "@/services/download";
import { StatusBar, Platform } from "react-native";
import { GlobalUIStateProvider } from "@/contexts/GlobalUIStateContext";

SplashScreen.preventAutoHideAsync();

TrackPlayer.registerPlaybackService(() => playbackService);

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    Meriva: require("../assets/fonts/Meriva.ttf"),
  });

  const [trackPlayerLoaded, setTrackPlayerLoaded] = useState(false);

  const handleTrackPlayerLoaded = useCallback(async () => {
    await TrackPlayer.reset();
    setTrackPlayerLoaded(true);
  }, []);

  useSetupTrackPlayer({
    onLoad: handleTrackPlayerLoaded,
  });

  useLogTrackPlayerState();
  useNotificationClickHandler();

  useEffect(() => {
    const initialize = async () => {
      await setupNotificationChannel();
      await initializeLibrary();

      try {
        if (Platform.OS === "android") {
          await SystemBars.setEdgeToEdge(true);
          await SystemBars.setStyle({
            statusBar: "light",
            navigationBar: "light",
          });
        }
      } catch (e) {
        console.log("System UI setup error:", e);
      }

      if (fontsLoaded && trackPlayerLoaded) {
        await SplashScreen.hideAsync();
      }
    };

    initialize();
  }, [fontsLoaded, trackPlayerLoaded]);

  if (!fontsLoaded || !trackPlayerLoaded) {
    return null;
  }

  return (
    <Provider store={store}>
      <MusicPlayerProvider>
        <LyricsProvider>
          <GlobalUIStateProvider>
            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <ThemeProvider value={DarkTheme}>
                  <StatusBar
                    hidden={true}
                    translucent={true}
                    backgroundColor="transparent"
                    barStyle="light-content"
                  />

                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: {
                        backgroundColor: "#000000",
                      },
                    }}
                  >
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                      name="player"
                      options={{
                        presentation: "transparentModal",
                        animation: "fade_from_bottom",
                        contentStyle: {
                          backgroundColor: "transparent",
                        },
                      }}
                    />
                    <Stack.Screen
                      name="(modals)/addToPlaylist"
                      options={{
                        presentation: "transparentModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="(modals)/deletePlaylist"
                      options={{
                        presentation: "transparentModal",
                        animation: "fade",
                      }}
                    />
                    <Stack.Screen
                      name="(modals)/queue"
                      options={{
                        presentation: "transparentModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="(modals)/lyrics"
                      options={{
                        presentation: "transparentModal",
                        animation: "fade_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="(modals)/menu"
                      options={{
                        presentation: "transparentModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen name="+not-found" />
                  </Stack>

                  <UpdateModal />
                  <MessageModal />
                </ThemeProvider>
              </GestureHandlerRootView>
            </SafeAreaProvider>
          </GlobalUIStateProvider>
        </LyricsProvider>
      </MusicPlayerProvider>
    </Provider>
  );
}