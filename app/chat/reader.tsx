import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { UserAvatar } from '../../src/components/UserAvatar';
import { themeClasses } from '../../src/theme/classes';

export default function ReaderScreen() {
  const { content, botName, botAvatar } = useLocalSearchParams();
  const router = useRouter();

  return (
    <SafeAreaView className={themeClasses.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Fixed Glass Header */}
      <View className={`absolute top-0 left-0 right-0 z-50 px-4 pt-[60px] pb-4 bg-white/90 dark:bg-space-light/90 backdrop-blur-md flex-row items-center ${themeClasses.headerBorder}`}>
        <Pressable onPress={() => router.back()} className={`mr-3 p-2 rounded-full ${themeClasses.press}`}>
          <ArrowLeft className={themeClasses.iconPrimary} size={24} />
        </Pressable>

        {botAvatar && <UserAvatar imageUri={botAvatar as string} size={32} className="mr-3" />}

        <Text className={`${themeClasses.textPrimary} text-lg font-bold flex-1`} numberOfLines={1}>
          {botName || 'Leitura'}
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-5 pt-32"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className={`${themeClasses.textPrimary} text-lg leading-8 font-sans`} selectable>
           {content}
        </Text>
      </ScrollView>

    </SafeAreaView>
  );
}
