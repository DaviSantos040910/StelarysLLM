import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { UserAvatar } from '../../src/components/UserAvatar';
import { ChatListItem } from '../../src/types/chat';
import { chatListService } from '../../src/services/chatListService';
import { ChatListItemRow } from '../../src/components/chat/ChatListItemRow';
import { Plus } from 'lucide-react-native';

export default function ChatListScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadChats = async () => {
    setIsLoading(true);
    try {
      const data = await chatListService.getActiveChats();
      setChats(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-space-dark" edges={['top']}>
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-4 mb-2 border-b border-white/5">
        <View>
             <Text className="text-starlight text-lg font-medium">Olá,</Text>
             <Text className="text-2xl font-bold text-starlight">{user?.username || 'Viajante'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <UserAvatar imageUri={user?.avatar_url} size={48} />
        </TouchableOpacity>
      </View>

      {/* Chat List */}
      {isLoading ? (
         <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#818cf8" />
         </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={({ item }) => <ChatListItemRow item={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadChats} tintColor="#818cf8" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6">
               <Text className="text-starlight text-lg font-bold mb-2">No conversations yet</Text>
               <Text className="text-gray-400 text-center">
                   Visit the Explore tab to find a Tutor and start learning!
               </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button - maybe to start new chat or just go to Explore? */}
      {/* The prompt says 'Conversations are study sessions'. Explore is for finding bots.
          Maybe this button should go to Explore?
      */}
      <TouchableOpacity
        className="absolute bottom-24 right-6 bg-cosmic-purple w-14 h-14 rounded-full justify-center items-center shadow-lg shadow-indigo-500/50"
        onPress={() => router.push('/(tabs)/explore')}
      >
        <Plus color="white" size={28} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
