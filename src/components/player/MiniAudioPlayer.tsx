import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Play, Pause, X } from 'lucide-react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useAudioPlayerStore } from '../../stores/audioPlayerStore';

export const MiniAudioPlayer = () => {
  const { currentUri, isMinimized, isPlaying, title, resume, pause, close, position, duration, maximize } = useAudioPlayerStore();

  if (!currentUri || !isMinimized) return null;

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutDown}
      className="absolute bottom-[90px] left-4 right-4 bg-space-light rounded-xl border border-white/10 shadow-lg overflow-hidden z-50"
    >
      {/* Progress Bar Line */}
      <View className="h-1 bg-white/10 w-full">
          <View style={{ width: `${progressPercent}%` }} className="h-full bg-cosmic-purple" />
      </View>

      <View className="flex-row items-center p-3">
          <Pressable
             onPress={isPlaying ? pause : resume}
             className="w-10 h-10 bg-white/5 rounded-full items-center justify-center mr-3 active:bg-white/10"
          >
              {isPlaying ? <Pause color="#fff" size={20} fill="#fff" /> : <Play color="#fff" size={20} fill="#fff" />}
          </Pressable>

          <Pressable className="flex-1" onPress={maximize}>
              <Text className="text-starlight font-bold text-sm" numberOfLines={1}>{title || 'Áudio'}</Text>
              <Text className="text-gray-400 text-xs">Toque para expandir</Text>
          </Pressable>

          <Pressable onPress={close} className="p-2">
              <X color="#94a3b8" size={20} />
          </Pressable>
      </View>
    </Animated.View>
  );
};
