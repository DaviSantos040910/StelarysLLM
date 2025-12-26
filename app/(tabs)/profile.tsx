import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white p-4">
      <View className="items-center mb-8 mt-4">
        <View className="w-24 h-24 bg-gray-200 rounded-full mb-4" />
        <Text className="text-xl font-bold">John Doe</Text>
        <Text className="text-gray-500">john@example.com</Text>
      </View>

      <TouchableOpacity
        className="bg-red-50 p-4 rounded-lg"
        onPress={() => router.replace('/(auth)/login')}
      >
        <Text className="text-red-500 text-center font-semibold">Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}
