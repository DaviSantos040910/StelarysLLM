// src/components/explore/ExploreBotRow.tsx
import React, { useState } from 'react';
import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { PlusCircle, CheckCircle } from 'lucide-react-native';
import { ExploreBotItem, exploreService } from '../../services/exploreService';
import { UserAvatar } from '../UserAvatar';
import { botService } from '../../services/botService';

interface Props {
  item: ExploreBotItem;
}

export const ExploreBotRow: React.FC<Props> = ({ item }) => {
  const router = useRouter();
  const [isSubscribed, setIsSubscribed] = useState(item.is_subscribed ?? false);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleSubscribe = async () => {
    setIsLoading(true);
    try {
      await exploreService.toggleBotSubscription(item.id);
      setIsSubscribed(prev => !prev);
    } catch (error) {
      console.error("Failed to toggle subscription:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowPress = async () => {
    try {
        const bootstrap = await botService.getChatBootstrap(item.id);
        const chatId = bootstrap.conversationId;

        // Navigate with params to help ChatScreen initialize faster
        router.push({
            pathname: `/chat/${chatId}` as any,
            params: {
                botId: item.id,
                botName: item.name,
                botAvatar: item.avatar_url,
                // suggestions: JSON.stringify(bootstrap.suggestions) // Optional
            }
        });
    } catch (error) {
        console.error("Failed to start chat:", error);
    }
  };

  return (
    <Pressable
        onPress={handleRowPress}
        className="flex-row items-center p-4 border-b border-white/5 bg-space-dark active:bg-space-light/30"
    >
      <UserAvatar imageUri={item.avatar_url} size={48} />

      <View className="flex-1 ml-3 mr-2">
        <Text className="text-starlight font-bold text-base" numberOfLines={1}>{item.name}</Text>
        <Text className="text-gray-400 text-sm" numberOfLines={2}>{item.description}</Text>
      </View>

      <Pressable onPress={handleToggleSubscribe} disabled={isLoading} className="p-2">
        {isLoading ? (
          <ActivityIndicator size="small" color="#818cf8" />
        ) : (
            isSubscribed ?
            <CheckCircle color="#818cf8" size={28} /> :
            <PlusCircle color="#94a3b8" size={28} />
        )}
      </Pressable>
    </Pressable>
  );
};
