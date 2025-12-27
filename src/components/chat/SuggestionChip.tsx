import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { MessageCircle } from 'lucide-react-native';

interface SuggestionChipProps {
  label: string;
  onPress: () => void;
}

export const SuggestionChip: React.FC<SuggestionChipProps> = ({ label, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      className="bg-space-light border border-white/10 rounded-xl px-4 py-3 mb-3 flex-row items-center active:bg-space-light/80"
    >
      <MessageCircle size={16} color="#818cf8" />
      <Text className="text-starlight text-base ml-2 font-medium">{label}</Text>
    </Pressable>
  );
};
