import React from 'react';
import { Text, View } from 'react-native';
import { themeClasses } from '../../theme/classes';
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
    <View className="px-4 pt-10 pb-8 overflow-hidden">
      {/* Hero Section */}
      <View className="items-center mb-8">
        <View className={`p-4 rounded-full shadow-lg shadow-black/20 mb-4 ${themeClasses.softSurface}`}>
          <UserAvatar imageUri={botAvatar} size={80} />
        </View>
        <Text className={`${themeClasses.textPrimary} text-2xl font-bold mb-2 text-center`}>{botName}</Text>
        <Text className={`${themeClasses.textSecondary} text-center text-base px-4 leading-6`}>
          {description}
        </Text>
      </View>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View className="w-full">
          <Text className={`${themeClasses.textMuted} text-sm font-bold uppercase mb-4 ml-1`}>
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
