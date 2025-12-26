import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function StudySessionScreen() {
  const { id } = useLocalSearchParams();

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-xl font-bold mb-4">Study Session {id}</Text>
      <View className="flex-1 border border-gray-200 rounded-lg p-4 mb-4">
        <Text className="text-gray-500 italic">Chat messages will appear here...</Text>
      </View>
    </View>
  );
}
