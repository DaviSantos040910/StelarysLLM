import '../global.css';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router'; // Adicionado useRootNavigationState
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';

export default function RootLayout() {
  const { loadUser, isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  
  // 1. Hook para verificar se a navegação está pronta
  const navigationState = useRootNavigationState();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    // 2. GUARD: Se a navegação não estiver pronta, não faz nada.
    // Isso evita o erro "Attempted to navigate before mounting"
    if (!navigationState?.key) return;

    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      // Usuário logado tentando acessar login -> manda para Home (Tabs)
      router.replace('/(tabs)'); 
    } else if (!isAuthenticated && !inAuthGroup) {
      // Usuário não logado fora da área de login -> manda para Login
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, segments, isLoading, navigationState?.key]); // Adicione navigationState?.key nas dependências

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