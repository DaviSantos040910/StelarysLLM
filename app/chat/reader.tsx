import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { UserAvatar } from '../../src/components/UserAvatar';

export default function ReaderScreen() {
  const { content, botName, botAvatar } = useLocalSearchParams();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-space-dark">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Fixed Glass Header */}
      <View className="absolute top-0 left-0 right-0 z-50 px-4 pt-[60px] pb-4 bg-space-light/90 border-b border-white/10 backdrop-blur-md flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3 p-2 rounded-full active:bg-white/10">
          <ArrowLeft color="#fff" size={24} />
        </Pressable>

        {botAvatar && <UserAvatar imageUri={botAvatar as string} size={32} className="mr-3" />}

        <Text className="text-starlight text-lg font-bold flex-1" numberOfLines={1}>
          {botName || 'Leitura'}
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-5 pt-32"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-starlight text-lg leading-8 font-sans" selectable>
           {content}
        </Text>
      </ScrollView>

    </SafeAreaView>
  );
}
