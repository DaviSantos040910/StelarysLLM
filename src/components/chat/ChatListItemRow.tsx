// src/components/chat/ChatListItemRow.tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChatListItem } from '../../types/chat';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { UserAvatar } from '../UserAvatar';

type Props = {
  item: ChatListItem;
};

// Simple helper to detect locale (mocking i18n for now if not fully integrated)
const getLocale = () => {
  return enUS;
};

// Function to format the timestamp
const formatTimestamp = (date: string) => {
    try {
      return formatDistanceToNowStrict(new Date(date), { addSuffix: true, locale: getLocale() });
    } catch (e) {
      return '';
    }
};

const stripMarkdown = (text: string | undefined | null): string => {
  if (!text) return '...';

  let newText = text
    .replace(/(\r\n|\n|\r)/gm, ' ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/#{1,6} (.*?)/g, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1');

  return newText
    .replace(/\s[\*-\+]\s+/g, ' ')
    .replace(/^\s*[\*-\+]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const ChatListItemRow: React.FC<Props> = ({ item }) => {
  const router = useRouter();

  const handlePress = () => {
    router.push({
        pathname: `/chat/${item.id}`,
        params: {
            botId: item.bot.id,
            botName: item.bot.name,
            botAvatar: item.bot.avatar_url,
            suggestion1: item.bot.suggestion1,
            suggestion2: item.bot.suggestion2,
            suggestion3: item.bot.suggestion3,
        }
    });
  };

  const lastMessageContent = stripMarkdown(item.last_message?.content);

  return (
    <Pressable
        onPress={handlePress}
        className="active:bg-space-light/50 px-4 py-3 border-b border-white/5"
    >
      <View className="flex-row items-center">
        <UserAvatar imageUri={item.bot.avatar_url} size={50} />

        <View className="flex-1 ml-3 justify-center">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-starlight font-bold text-base" numberOfLines={1}>{item.bot.name}</Text>
            {item.last_message_at && (
              <Text className="text-gray-500 text-xs">
                {formatTimestamp(item.last_message_at)}
              </Text>
            )}
          </View>
         <Text className="text-gray-400 text-sm" numberOfLines={1}>
            {lastMessageContent}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};
