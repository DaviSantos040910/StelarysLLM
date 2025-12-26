import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function LibraryScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Text className="text-xl font-bold mb-4">Your Library</Text>

      <TouchableOpacity
        className="bg-white p-4 rounded-lg shadow mb-4"
        onPress={() => router.push('/study/123')}
      >
        <Text className="font-semibold text-lg">Physics 101</Text>
        <Text className="text-gray-500">Last studied 2 hours ago</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="absolute bottom-8 right-8 bg-blue-500 w-14 h-14 rounded-full justify-center items-center shadow-lg"
        onPress={() => router.push('/create')}
      >
        <Text className="text-white text-3xl pb-1">+</Text>
      </TouchableOpacity>
    </View>
  );
}
