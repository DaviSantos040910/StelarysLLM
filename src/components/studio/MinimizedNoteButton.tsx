import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useMinimizedStore } from '../../stores/minimizedStore';

export const MinimizedNoteButton = () => {
  const { minimizedArtifact, closeNote } = useMinimizedStore();
  const router = useRouter();

  if (!minimizedArtifact) return null;

  const handlePress = () => {
    // Navigate to gallery to restore context.
    // Passing params to trigger restoration logic in the target screen.
    // Ensure casting if strict types complain, although Href<string> is safer.
    router.push({
      pathname: '/studio/gallery' as any,
      params: {
        chatId: minimizedArtifact.chatId,
        restoreId: minimizedArtifact.id
      }
    });
  };

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={Layout.springify()}
      className="absolute top-24 right-4 z-[999]"
    >
      <View className="flex-row items-center">
          <Pressable
            onPress={handlePress}
            className="w-14 h-14 bg-space-light rounded-full border border-cosmic-purple/50 items-center justify-center shadow-lg shadow-cosmic-purple/30"
          >
            <FileText color="#818cf8" size={24} />
            <View className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border border-space-dark" />
          </Pressable>

          {/* Close Button (Small X next to it) */}
          <Pressable
            onPress={closeNote}
            className="ml-2 p-1 bg-black/40 rounded-full"
          >
             <X color="#fff" size={14} />
          </Pressable>
      </View>
    </Animated.View>
  );
};
