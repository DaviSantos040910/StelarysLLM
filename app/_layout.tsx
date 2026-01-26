import '../global.css';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { MiniAudioPlayer } from '../src/components/player/MiniAudioPlayer';
import { useThemeStore } from '../src/stores/themeStore';
import { useColorScheme } from 'nativewind';

export default function RootLayout() {
  const { loadUser, isAuthenticated, isLoading } = useAuthStore();
  const { mode } = useThemeStore();
  const { setColorScheme } = useColorScheme();

  const segments = useSegments();
  const router = useRouter();
  
  const navigationState = useRootNavigationState();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  // Initial load
  useEffect(() => {
    loadUser();
    setColorScheme(mode);
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
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)'); 
    } else if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, segments, isLoading, isNavigationReady]);

  // Determine status bar style based on theme mode
  const statusBarStyle = mode === 'dark' ? 'light' : (mode === 'light' ? 'dark' : 'auto');
  const backgroundColor = mode === 'dark' ? '#020617' : '#f8fafc'; // Matches tailwind config

  return (
    <View className="flex-1 bg-gray-50 dark:bg-space-dark">
      <Stack screenOptions={{
        headerShown: false,
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
      </Stack>

      {/* Global Mini Audio Player */}
      <MiniAudioPlayer />

      <StatusBar style={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 z-50 justify-center items-center bg-gray-50 dark:bg-space-dark">
          <ActivityIndicator size="large" color="#818cf8" />
        </View>
      )}
    </View>
  );
}
