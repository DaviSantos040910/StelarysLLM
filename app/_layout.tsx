import '../global.css';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';

export default function RootLayout() {
  const { loadUser, isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  
  const navigationState = useRootNavigationState();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!navigationState?.key) return;

    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)'); 
    } else if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, segments, isLoading, navigationState?.key]);

  if (isLoading) {
    return (
       <View style={{ flex: 1 }}>
        {/* O Stack precisa existir para o router funcionar, mesmo que escondido */}
        <View style={{ display: 'none' }}>
           <Stack />
        </View>
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
     </View> 

    );
  }

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
      <StatusBar style="light" backgroundColor="#0b0e14" />
    </View>
  );
}
