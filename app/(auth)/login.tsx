import { useLocalSearchParams, useRouter } from 'expo-router';
import { Rocket } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useAuthStore } from '../../src/stores/authStore';
import { themeClasses } from '../../src/theme/classes';

export default function LoginScreen() {
  const router = useRouter();
  const { redirectTo, reason, message } = useLocalSearchParams<{ redirectTo: string; reason: string; message: string }>();
  const { login, isLoading, error } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      if (redirectTo) {
        router.replace(redirectTo as any);
      } else {
        router.replace('/(tabs)');
      }
    } catch (e) {
      // Error is handled in store and displayed via Alert or UI
    }
  };

  return (
    <SafeAreaView className={`${themeClasses.screen} p-6 justify-center`}>
      <View className="mb-10 items-center">
        <View className={`p-4 rounded-full mb-4 ${themeClasses.softSurface}`}>
          <Rocket size={48} color="#6366f1" />
        </View>
        <Text className={`${themeClasses.textPrimary} text-3xl font-bold mb-2`}>Welcome Back</Text>
        <Text className={`${themeClasses.textSecondary} text-base`}>Sign in to continue to StelarysLM</Text>
      </View>

      {reason === 'trial_limit' && (
        <View className="bg-amber-900/50 border border-amber-500/50 p-4 rounded-xl mb-6 flex-row items-center">
          <View className="mr-3">
             <Rocket size={20} color="#fbbf24" />
          </View>
          <Text className="text-amber-100 flex-1 font-medium">
            {message || 'Você atingiu o limite gratuito. Entre para ver opções.'}
          </Text>
        </View>
      )}

      {error && (
        <View className="bg-red-900/50 border border-red-500/50 p-3 rounded-lg mb-4">
          <Text className="text-red-200">{error}</Text>
        </View>
      )}

      <Input
        label="Email or Username"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        containerStyle="mb-4"
      />

      <Input
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        containerStyle="mb-6"
      />

      <Button
        title={isLoading ? "Signing In..." : "Sign In"}
        onPress={handleLogin}
        disabled={isLoading}
        className="mt-4"
      />

      {isLoading && <ActivityIndicator className="mt-4" color="#06b6d4" />}

      <View className="flex-row justify-center mt-6">
        <Text className={themeClasses.textMuted}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
          <Text className="text-indigo-500 dark:text-cyan-400 font-semibold">Sign Up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
