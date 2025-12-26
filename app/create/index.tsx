import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function CreateStudyScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-xl font-bold mb-4">Create New Study</Text>

      <TouchableOpacity
        className="bg-blue-500 p-3 rounded-lg mt-4"
        onPress={() => router.back()}
      >
        <Text className="text-white text-center font-semibold">Create</Text>
      </TouchableOpacity>
    </View>
  );
}
