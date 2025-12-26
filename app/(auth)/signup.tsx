import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';

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
    <SafeAreaView className="flex-1 bg-space-bg p-6 justify-center">
      <View className="mb-8 items-center">
        <View className="bg-secondary/20 p-4 rounded-full mb-4">
           <Star size={48} color="#d946ef" />
        </View>
        <Text className="text-3xl font-bold text-white mb-2">Create Account</Text>
        <Text className="text-gray-400 text-base">Join StelarysLM to start learning</Text>
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
        variant="secondary"
      />

      {isLoading && <ActivityIndicator className="mt-4" color="#d946ef" />}

      <View className="flex-row justify-center mt-6">
        <Text className="text-gray-400">Already have an account? </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-accent-purple font-semibold">Log In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
