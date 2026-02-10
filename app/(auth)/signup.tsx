import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import { themeClasses } from '../../src/theme/classes';

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

    try {
      await signup({ username, email, password });
      Alert.alert('Success', 'Account created! Please check your email to verify.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      // Error handled in store
    }
  };

  return (
    <SafeAreaView className={`${themeClasses.screen} p-6 justify-center`}>
      <View className="mb-8 items-center">
        <View className={`p-4 rounded-full mb-4 ${themeClasses.softSurface}`}>
           <Star size={48} color="#d946ef" />
        </View>
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
        title="Sign Up"
        onPress={handleSignup}
        loading={isLoading}
        className="mt-4"
        variant="primary"
      />

      <View className="flex-row justify-center mt-6">
        <Text className={themeClasses.textMuted}>Already have an account? </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-indigo-500 dark:text-cyan-400 font-semibold">Log In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
