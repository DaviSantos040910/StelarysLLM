import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

export default function RootLayout() {
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
