import '../global.css';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { MinimizedNoteButton } from '../src/components/studio/MinimizedNoteButton';

export default function RootLayout() {
  const { loadUser, isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  
  const navigationState = useRootNavigationState();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  // Wait for navigation state to be ready
  useEffect(() => {
    if (!isNavigationReady && navigationState?.key) {
      setIsNavigationReady(true);
    }
  }, [navigationState?.key]);

  useEffect(() => {
    // Only run navigation logic if the root navigator is ready
    if (!isNavigationReady) return;
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)'); 
    } else if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, segments, isLoading, isNavigationReady]);

  return (
    <View className="flex-1 bg-background">
      <Stack screenOptions={{
        headerStyle: { backgroundColor: '#0b0e14' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0b0e14' },
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="study/[id]" options={{ title: 'Study Session', headerBackTitle: 'Back' }} />
        <Stack.Screen name="study/details" options={{ title: 'Settings', headerBackTitle: 'Back' }} />
        <Stack.Screen name="create/index" options={{ presentation: 'modal', title: 'New Study', headerBackTitle: 'Back' }} />
      </Stack>

      {/* Global Minimized Note Button */}
      <MinimizedNoteButton />

      <StatusBar style="light" backgroundColor="#0b0e14" />

      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 z-50 justify-center items-center bg-[#0b0e14]">
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      )}
    </View>
  );
}
