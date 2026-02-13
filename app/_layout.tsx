// app/_layout.tsx - MAVIN ENGINE INTEGRATED
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useSegments } from "expo-router";
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
import { StatusBar, Platform, View, ActivityIndicator } from "react-native";
import { GlobalUIStateProvider } from "@/contexts/GlobalUIStateContext";
import FloatingPlayer from "@/components/FloatingPlayer";

// ============================================================================
// MAVIN ENGINE INTEGRATIONS (Critical Bootstrap)
// ============================================================================
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GracePeriodManager } from "@/services/mavin/monetization/GracePeriod";
import { AdMonetization } from "@/services/mavin/monetization/AdMonetization";
import { SelfHealing } from "@/services/mavin/core/SelfHealing";
import { MavinCache } from "@/services/mavin/core/CacheLayer";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";

// Initialize TanStack Query Client (Singleton)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

SplashScreen.preventAutoHideAsync();
TrackPlayer.registerPlaybackService(() => playbackService);

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

// ============================================================================
// MAIN LAYOUT WRAPPER (Preserved Existing Structure)
// ============================================================================
const MainLayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  const segments = useSegments();
  const isPlayerScreen = segments.includes('(player)');
  
  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <View style={{ flex: 1 }}>{children}</View>
      
      {/* Floating Player - Hidden on Player Screen */}
      {!isPlayerScreen && (
        <View style={{ 
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        }}>
          <FloatingPlayer />
        </View>
      )}
    </View>
  );
};

// ============================================================================
// LOADING SCREEN (Preserved Existing Structure)
// ============================================================================
const LoadingScreen = () => (
  <View style={{ 
    flex: 1, 
    backgroundColor: "#000000", 
    justifyContent: "center", 
    alignItems: "center" 
  }}>
    <ActivityIndicator color="#D4AF37" size="large" />
    <StatusBar
      barStyle="light-content"
      backgroundColor="transparent"
      translucent={true}
    />
  </View>
);

// ============================================================================
// ROOT LAYOUT WITH MAVIN ENGINE BOOTSTRAP
// ============================================================================
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    Meriva: require("../assets/fonts/Meriva.ttf"),
  });

  const [trackPlayerReady, setTrackPlayerReady] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [appInitialized, setAppInitialized] = useState(false);

  // ============================================================================
  // TRACK PLAYER SETUP (Preserved Existing Logic)
  // ============================================================================
  const handleTrackPlayerReady = useCallback(async () => {
    try {
      console.log('[App] Setting up TrackPlayer...');
      setTrackPlayerReady(true);
    } catch (error) {
      console.warn('[App] TrackPlayer setup error:', error);
      setTrackPlayerReady(true);
    }
  }, []);

  useSetupTrackPlayer({ onLoad: handleTrackPlayerReady });
  useLogTrackPlayerState();
  useNotificationClickHandler();

  // ============================================================================
  // MAVIN ENGINE BOOTSTRAP (Critical New Logic)
  // ============================================================================
  useEffect(() => {
    const bootstrapMavinEngine = async () => {
      try {
        console.log('[Mavin Bootstrap] Starting engine initialization...');
        
        // STEP 1: Initialize Grace Period Manager
        const graceManager = GracePeriodManager.getInstance(queryClient);
        await graceManager.initialize();
        console.log('[Mavin Bootstrap] ✓ Grace Period Manager initialized');
        
        // STEP 2: Initialize Ad Monetization
        const adEngine = AdMonetization.getInstance(queryClient);
        adEngine.initialize();
        console.log('[Mavin Bootstrap] ✓ Ad Monetization initialized');
        
        // STEP 3: Initialize Self-Healing Engine (opt-in to community intelligence)
        const healingEngine = SelfHealing.getInstance(queryClient);
        healingEngine.initialize(true); // true = opt-in to community cache sharing
        console.log('[Mavin Bootstrap] ✓ Self-Healing Engine initialized');
        
        // STEP 4: Pre-cache Nigeria Top 50 (background task - non-blocking)
        const cacheNigeriaTop50 = async () => {
          try {
            // Check if already cached
            const cached = await MavinCache.get('chart:nigeria-top-50', async () => { 
              throw new Error('MISS'); 
            });
            
            if (cached) {
              console.log('[Mavin Bootstrap] ✓ Nigeria Top 50 already cached');
              return;
            }
            
            // Pre-cache metadata (in production: fetch from Supabase)
            const mockChart = {
              songs: Array.from({ length: 50 }, (_, i) => ({
                id: `nigeria-song-${i}`,
                title: `Nigerian Hit ${i + 1}`,
                artist: `Artist ${i + 1}`,
                videoId: `video-${i}`,
                duration: 180 + Math.floor(Math.random() * 120),
              })),
              lastUpdated: Date.now(),
            };
            
            await MavinCache.set(
              'chart:nigeria-top-50',
              mockChart,
              24 * 60 * 60 * 1000, // 24 hours
              'L1_DEVICE'
            );
            
            console.log('[Mavin Bootstrap] ✓ Nigeria Top 50 pre-cached');
            
          } catch (error) {
            logError(errorFromUnknown(error), 'warn');
            console.warn('[Mavin Bootstrap] ⚠️ Nigeria Top 50 pre-cache failed (non-fatal)');
          }
        };
        
        // Start pre-cache in background (non-blocking)
        cacheNigeriaTop50();
        
        // Mark engine as ready
        setEngineReady(true);
        console.log('[Mavin Bootstrap] ✓ Engine initialization COMPLETE');
        
      } catch (error) {
        const mavinError = errorFromUnknown(error);
        logError(mavinError, 'error');
        console.error('[Mavin Bootstrap] ✗ Initialization failed:', mavinError.message);
        
        // NON-FATAL: Engine failures shouldn't block app launch
        setEngineReady(true);
      }
    };
    
    bootstrapMavinEngine();
  }, []);

  // ============================================================================
  // APP INITIALIZATION (Preserved Existing Logic + Engine Ready Check)
  // ============================================================================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Setup notification channel
        await setupNotificationChannel();
        
        // Initialize library
        await initializeLibrary();
        
        console.log('[App] ✓ App initialization complete');
        
        // Hide splash screen ONLY when ALL dependencies ready
        if (fontsLoaded && trackPlayerReady && engineReady) {
          console.log('[App] ✓ All dependencies loaded, hiding splash screen');
          await SplashScreen.hideAsync();
          setAppInitialized(true);
        }
      } catch (error) {
        console.warn('[App] App initialization error:', error);
        
        // Still hide splash screen if critical dependencies ready
        if (fontsLoaded && trackPlayerReady && engineReady) {
          await SplashScreen.hideAsync();
          setAppInitialized(true);
        }
      }
    };

    initializeApp();
  }, [fontsLoaded, trackPlayerReady, engineReady]);

  // ============================================================================
  // LOADING STATE (Preserved Existing Logic)
  // ============================================================================
  if (!fontsLoaded || !trackPlayerReady || !engineReady) {
    return <LoadingScreen />;
  }

  // ============================================================================
  // MAIN APP RENDER (Preserved Existing Structure + QueryClientProvider)
  // ============================================================================
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
                      translucent={true}
                    />

                    <MainLayoutWrapper>
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          contentStyle: { backgroundColor: "#000000" },
                        }}
                      >
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen
                          name="(player)"
                          options={{
                            presentation: "transparentModal",
                            animation: "slide_from_bottom",
                            contentStyle: { backgroundColor: "transparent" },
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
                          name="(modals)/comments"
                          options={{
                            presentation: "transparentModal",
                            animation: "slide_from_bottom",
                          }}
                        />
                       <Stack.Screen
                          name="(modals)/equalizer"
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
                          name="(modals)/premium"
                          options={{
                            presentation: "transparentModal",
                            animation: "slide_from_bottom",
                          }}
                        />

                         <Stack.Screen
                          name="(modals)/related"
                          options={{
                            presentation: "transparentModal",
                            animation: "slide_from_bottom",
                          }}
                        />

                        <Stack.Screen
                          name="(modals)/lyrics"
                          options={{
                            presentation: "transparentModal",
                            animation: "slide_from_bottom",
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
                    </MainLayoutWrapper>

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