import { useRouter } from 'expo-router';

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useAuthStore } from '../../src/stores/authStore';
import { themeClasses } from '../../src/theme/classes';

import { validatePasswordLocally } from '../../src/utils/errorHandling';

export default function SignupScreen() {
  const router = useRouter();
  const { signup, isLoading, error } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    if (!username || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const passwordError = validatePasswordLocally(password);
    if (passwordError) {
      Alert.alert('Erro', passwordError);
      return;
    }

    try {
      await signup({ username, email, password });
      Alert.alert('Success', 'Account created! Please check your email to verify.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      // Error might be handled by interceptor if quota/etc (unlikely for signup but good practice)
      if (e?.isHandled) return;
      // Otherwise error is handled in store (displayed in UI)
    }
  };

  return (
    <SafeAreaView className={`${themeClasses.screen} p-6 justify-center`}>
      <View className="mb-8 items-center">
        <Image
          source={require('../../assets/images/logo.png')}
          style={{ width: 100, height: 100, borderRadius: 24, marginBottom: 16 }}
          resizeMode="cover"
        />
        <Text className={`${themeClasses.textPrimary} text-3xl font-bold mb-2`}>Create Account</Text>
        <Text className={`${themeClasses.textSecondary} text-base`}>Join StelarysLM to start learning</Text>
      </View>

      {error && (
        <View className="bg-red-900/50 border border-red-500/50 p-3 rounded-lg mb-4">
          <Text className="text-red-200">{error}</Text>
        </View>
      )}

      <Input
        label="Username"
        placeholder="Choose a username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        containerStyle="mb-4"
      />

      <Input
        label="Email"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        containerStyle="mb-4"
      />

      <Input
        label="Password"
        placeholder="Create a password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        containerStyle="mb-6"
      />

      <Button
        title={isLoading ? "Creating Account..." : "Sign Up"}
        onPress={handleSignup}
        disabled={isLoading}
        className="mt-4"
        variant="primary"
      />

      {isLoading && <ActivityIndicator className="mt-4" color="#818cf8" />}

      <View className="flex-row justify-center mt-6">
        <Text className={themeClasses.textMuted}>Already have an account? </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-indigo-500 dark:text-cyan-400 font-semibold">Log In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
