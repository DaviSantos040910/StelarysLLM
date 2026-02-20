import '../global.css';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useAppStore } from '../src/stores/appStore';
import { useBillingStore } from '../src/stores/billingStore';
import { MiniAudioPlayer } from '../src/components/player/MiniAudioPlayer';
import { useThemeStore } from '../src/stores/themeStore';
import { useColorScheme } from 'nativewind';
import { themeClasses } from '../src/theme/classes';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState } from 'react-native';
import { iapService } from '../src/services/iapService';

export default function RootLayout() {
  const { loadUser, isAuthenticated, isLoading: isAuthLoading } = useAuthStore();
  const { checkOnboarding, hasSeenOnboarding, isLoading: isAppLoading } = useAppStore();
  const { fetchStatus } = useBillingStore();
  const { mode } = useThemeStore();
  const { setColorScheme } = useColorScheme();

  const segments = useSegments();
  const router = useRouter();
  
  const navigationState = useRootNavigationState();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  // Initial load
  useEffect(() => {
    console.log('Starting loadUser and checkOnboarding');
    loadUser().then(() => console.log('loadUser finished')).catch(e => console.error('loadUser failed', e));
    checkOnboarding().then(() => console.log('checkOnboarding finished')).catch(e => console.error('checkOnboarding failed', e));
    fetchStatus(); // Fetch billing status
    setColorScheme(mode);
    iapService.initialize(); // Initialize IAP

    // Refresh billing on app resume
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchStatus();
      }
    });

    return () => {
      subscription.remove();
      iapService.teardown();
    };
  }, []);

  // Sync theme when store updates
  useEffect(() => {
    setColorScheme(mode);
  }, [mode]);

  // Wait for navigation state to be ready
  useEffect(() => {
    if (!isNavigationReady && navigationState?.key) {
      setIsNavigationReady(true);
    }
  }, [navigationState?.key]);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (isAuthLoading || isAppLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!hasSeenOnboarding && !inOnboarding) {
        // Force onboarding if not seen
        router.replace('/onboarding');
        return;
    }

    if (hasSeenOnboarding) {
        if (isAuthenticated && inAuthGroup) {
            // Logged in user trying to access auth pages -> redirect to home
            router.replace('/(tabs)');
        }
        // Guest mode support:
        // If !isAuthenticated, we do NOT force login anymore.
        // We allow access to (tabs) or other routes.
        // If user explicitly navigates to (auth), we allow it (handled by UI).
    }

  }, [isAuthenticated, segments, isAuthLoading, isAppLoading, isNavigationReady, hasSeenOnboarding]);

  // Determine status bar style based on theme mode
  const statusBarStyle = mode === 'dark' ? 'light' : (mode === 'light' ? 'dark' : 'auto');
  const backgroundColor = mode === 'dark' ? '#020617' : '#f8fafc'; // Matches tailwind config
  const headerTintColor = mode === 'dark' ? '#f8fafc' : '#111827'; // starlight vs gray-900

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className={themeClasses.screen}>
        <Stack screenOptions={{
          headerShown: false,
          headerTintColor: headerTintColor,
          contentStyle: { backgroundColor: 'transparent' }, // Let View handle bg
          animation: 'slide_from_right'
        }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />

          {/* Chat Routes */}
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="chat/reader" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="chat/manage-sources" options={{ headerShown: false }} />
          <Stack.Screen name="chat/history" options={{ headerShown: false }} />

          {/* Studio Routes */}
          <Stack.Screen name="studio/gallery" options={{ headerShown: false }} />

          {/* Profile Routes */}
          <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
          <Stack.Screen name="profile/security" options={{ headerShown: false }} />

          {/* Bot Routes */}
          <Stack.Screen name="bots/create" options={{ headerShown: false }} />

          {/* Library Routes */}
          <Stack.Screen name="library/[id]" options={{ headerShown: false }} />

          {/* Billing Routes */}
          <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="plans" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>

        {/* Global Mini Audio Player */}
        <MiniAudioPlayer />

        <StatusBar style={statusBarStyle} backgroundColor={backgroundColor} />

        {/* Loading Overlay */}
        {(isAuthLoading || isAppLoading) && (
          <View className={`absolute inset-0 z-50 justify-center items-center ${themeClasses.screen}`}>
            <ActivityIndicator size="large" color="#818cf8" />
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}
