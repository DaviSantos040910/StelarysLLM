import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function SignupScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 justify-center items-center bg-white p-4">
      <Text className="text-2xl font-bold mb-8">Sign Up</Text>
      <TouchableOpacity
        className="bg-green-500 px-6 py-3 rounded-lg"
        onPress={() => router.replace('/(tabs)')}
      >
        <Text className="text-white font-semibold">Create Account</Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="mt-4"
        onPress={() => router.back()}
      >
        <Text className="text-blue-500">Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}
