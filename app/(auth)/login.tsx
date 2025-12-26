import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 justify-center items-center bg-white p-4">
      <Text className="text-2xl font-bold mb-8">Login</Text>
      <TouchableOpacity
        className="bg-blue-500 px-6 py-3 rounded-lg"
        onPress={() => router.replace('/(tabs)')}
      >
        <Text className="text-white font-semibold">Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="mt-4"
        onPress={() => router.push('/(auth)/signup')}
      >
        <Text className="text-blue-500">Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}
