import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      // Alert.alert('Login Failed', error || 'Something went wrong');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white p-6 justify-center">
      <View className="mb-8">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</Text>
        <Text className="text-gray-500 text-base">Sign in to continue to StelarysLM</Text>
      </View>

      {error && (
        <View className="bg-red-50 p-3 rounded-lg mb-4">
          <Text className="text-red-500">{error}</Text>
        </View>
      )}

      <Input
        label="Email or Username"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Input
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button
        title={isLoading ? "Signing In..." : "Sign In"}
        onPress={handleLogin}
        disabled={isLoading}
        className="mt-4"
      />

      {isLoading && <ActivityIndicator className="mt-4" color="#3b82f6" />}

      <View className="flex-row justify-center mt-6">
        <Text className="text-gray-500">Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
          <Text className="text-blue-500 font-semibold">Sign Up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
