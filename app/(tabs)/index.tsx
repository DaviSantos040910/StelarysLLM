import { useFocusEffect, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatListItemRow } from '../../src/components/chat/ChatListItemRow';
import { UserAvatar } from '../../src/components/UserAvatar';
import { useMiniPlayerHeight } from '../../src/hooks/useMiniPlayerHeight';
import { chatListService } from '../../src/services/chatListService';
import { useAuthStore } from '../../src/stores/authStore';
import { ChatListItem } from '../../src/types/chat';
import { themeClasses } from '../../src/theme/classes';

// Wrapper component to apply entry animations
const AnimatedChatRow = ({ item, index }: { item: ChatListItem; index: number }) => {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(350).springify()}
    >
      <ChatListItemRow item={item} />
    </Animated.View>
  );
};

export default function ChatListScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const miniPlayerHeight = useMiniPlayerHeight();
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
    <SafeAreaView className={themeClasses.screen} edges={['top']}>
      {/* Header */}
      <View className={`flex-row justify-between items-center px-4 py-4 mb-2 bg-white/95 dark:bg-space-dark/95 backdrop-blur-md z-10 ${themeClasses.headerBorder}`}>
        <View>
          <Text className={`${themeClasses.textPrimary} text-lg font-medium`}>Olá,</Text>
          <Text className={`text-2xl font-bold ${themeClasses.textPrimary}`}>{user?.username || 'Estudante'}</Text>
        </View>
      </View>

      {/* Chat List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#818cf8" />
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={({ item, index }) => <AnimatedChatRow item={item} index={index} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 + miniPlayerHeight }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadChats} tintColor="#818cf8" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6">
              <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${themeClasses.softSurface}`}>
                <Text className="text-4xl">👋</Text>
              </View>
              <Text className={`${themeClasses.textPrimary} text-lg font-bold mb-2`}>Sem conversas ainda</Text>
              <Text className={`${themeClasses.textMuted} text-center`}>
                Visite a aba Explorar para encontrar um Tutor e começar a aprender!
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={{ bottom: 96 + miniPlayerHeight }}
        className="absolute right-6 bg-cosmic-purple w-14 h-14 rounded-full justify-center items-center shadow-lg shadow-indigo-500/50 active:scale-95 transition-transform"
        onPress={() => router.push('/bots/create')}
      >
        <Plus color="white" size={28} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
