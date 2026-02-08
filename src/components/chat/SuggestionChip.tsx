import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { themeClasses } from '../../theme/classes';

interface SuggestionChipProps {
  label: string;
  onPress: () => void;
}

export const SuggestionChip: React.FC<SuggestionChipProps> = ({ label, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl px-4 py-3 mb-3 flex-row items-center ${themeClasses.softSurface} ${themeClasses.press}`}
    >
      <MessageCircle size={16} color="#818cf8" />
      <Text className={`${themeClasses.textPrimary} text-base ml-2 font-medium`}>{label}</Text>
    </Pressable>
  );
};
