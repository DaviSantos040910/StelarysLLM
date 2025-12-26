import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Rocket } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
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
      router.replace('/(tabs)');
    } catch (e) {
      // Error is handled in store and displayed via Alert or UI
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-space-bg p-6 justify-center">
      <View className="mb-10 items-center">
        <View className="bg-nebula/20 p-4 rounded-full mb-4">
           <Rocket size={48} color="#6366f1" />
        </View>
        <Text className="text-3xl font-bold text-white mb-2">Welcome Back</Text>
        <Text className="text-gray-400 text-base">Sign in to continue to StelarysLM</Text>
      </View>

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
        <Text className="text-gray-400">Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
          <Text className="text-accent-cyan font-semibold">Sign Up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
