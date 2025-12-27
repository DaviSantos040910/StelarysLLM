// src/components/explore/ExploreBotRow.tsx
import React, { useState } from 'react';
import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { PlusCircle, CheckCircle } from 'lucide-react-native';
import { ExploreBotItem, exploreService } from '../../services/exploreService';
import { UserAvatar } from '../UserAvatar';
import client from '../../api/client';

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
    // When clicking a bot in Explore, we want to start a chat.
    // We need to get or create a conversation.
    try {
        // Assuming there is an endpoint to get/create chat for a bot
        // If not, we might need to add logic here.
        // For now, let's assume we navigate to a new chat with the bot ID as param
        // or check if a chat exists.
        // The old code used `botService.getChatBootstrap`.
        // Let's implement a simple direct call to create/get chat.

        const response = await client.post<{ id: string }>(`/api/v1/chats/start/${item.id}/`);
        const chatId = response.data.id;
        router.push(`/chat/${chatId}`);
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
