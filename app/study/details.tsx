import { View, Text } from 'react-native';

export default function StudyDetailsScreen() {
  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-xl font-bold mb-4">Study Settings</Text>
      <Text>Configuration options for this study space.</Text>
    </View>
  );
}
