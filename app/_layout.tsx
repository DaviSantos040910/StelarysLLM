import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';

export default function RootLayout() {
  const { loadUser, isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inAuthGroup && segments[0] !== 'create' && segments[0] !== 'study') {
       // Ideally we protect routes here.
       // For now, if not authenticated, redirect to login if trying to access tabs?
       // But wait, the app structure has (auth) and (tabs).
       // If user is not authenticated, they should be in (auth).
       // If they are at root, redirect to login.
    }
  }, [isAuthenticated, segments, isLoading]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="study/[id]" options={{ title: 'Study Session' }} />
        <Stack.Screen name="study/details" options={{ title: 'Settings' }} />
        <Stack.Screen name="create/index" options={{ presentation: 'modal', title: 'New Study' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
