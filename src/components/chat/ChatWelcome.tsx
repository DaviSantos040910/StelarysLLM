import React from 'react';
import { View, Text } from 'react-native';
import { UserAvatar } from '../UserAvatar';
import { SuggestionChip } from './SuggestionChip';

interface ChatWelcomeProps {
  botAvatar?: string | null;
  botName: string;
  description: string;
  suggestions: string[];
  onSuggestionPress: (suggestion: string) => void;
  showSuggestions?: boolean;
}

export const ChatWelcome: React.FC<ChatWelcomeProps> = ({
  botAvatar,
  botName,
  description,
  suggestions,
  onSuggestionPress,
  showSuggestions = true,
}) => {
  return (
    <View className="flex-1 px-4 pt-10 pb-8">
      {/* Hero Section */}
      <View className="items-center mb-8">
        <View className="bg-space-light p-4 rounded-full border border-white/5 shadow-lg shadow-black/20 mb-4">
          <UserAvatar imageUri={botAvatar} size={80} />
        </View>
        <Text className="text-starlight text-2xl font-bold mb-2 text-center">{botName}</Text>
        <Text className="text-gray-400 text-center text-base px-4 leading-6">
          {description}
        </Text>
      </View>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View className="w-full">
          <Text className="text-gray-500 text-sm font-bold uppercase mb-4 ml-1">
            Conversation Starters
          </Text>
          {suggestions.map((suggestion, index) => (
            <SuggestionChip
              key={index}
              label={suggestion}
              onPress={() => onSuggestionPress(suggestion)}
            />
          ))}
        </View>
      )}
    </View>
  );
};
