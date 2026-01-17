import { usePathname, useRouter } from 'expo-router';
import { Pause, Play, X } from 'lucide-react-native';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayerStore } from '../../stores/audioPlayerStore';

// Opções de velocidade disponíveis
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const MiniAudioPlayer = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const {
    currentUri,
    isMinimized,
    isPlaying,
    title,
    resume,
    pause,
    close,
    position,
    duration,
    maximize,
    rate,
    setRate,
    chatId,
    artifactId
  } = useAudioPlayerStore();

  if (!currentUri || !isMinimized) return null;

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  // Padding de baixo para ficar acima da safe area (home indicator do iPhone)
  const bottomPadding = Platform.OS === 'ios' ? insets.bottom : 8;

  const handlePress = () => {
    // Maximiza o player (tira do modo minimizado)
    maximize();

    // Se já estamos na galeria, não navegamos novamente
    const isOnGallery = pathname?.includes('/studio/gallery');

    if (isOnGallery) {
      // Já estamos na galeria, não precisa navegar
      // O maximize já vai abrir o modal com o artefato correto
      return;
    }

    // Navega para a galeria com o artefato selecionado
    if (chatId && artifactId) {
      try {
        router.push(`/studio/gallery?chatId=${chatId}&openArtifactId=${artifactId}` as any);
      } catch (error) {
        console.error('Navigation error:', error);
      }
    } else if (chatId) {
      try {
        router.push(`/studio/gallery?chatId=${chatId}` as any);
      } catch (error) {
        console.error('Navigation error:', error);
      }
    }
  };

  const handleClose = async () => {
    try {
      await close();
    } catch (error) {
      console.error('Close error:', error);
    }
  };

  const handleSpeedChange = async () => {
    try {
      const currentIndex = SPEED_OPTIONS.indexOf(rate);
      const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
      await setRate(SPEED_OPTIONS[nextIndex]);
    } catch (error) {
      console.error('Speed change error:', error);
    }
  };

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutDown}
      style={{
        bottom: 0,
        paddingBottom: bottomPadding,
        paddingHorizontal: 16
      }}
      className="absolute left-0 right-0 bg-space-dark z-50"
    >
      <View className="bg-space-light rounded-xl border border-white/10 shadow-lg overflow-hidden">
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

          <Pressable className="flex-1" onPress={handlePress}>
            <Text className="text-starlight font-bold text-sm" numberOfLines={1}>{title || 'Áudio'}</Text>
            <Text className="text-gray-400 text-xs">Toque para expandir</Text>
          </Pressable>

          {/* Speed Control */}
          <Pressable
            onPress={handleSpeedChange}
            className="px-2 py-1 bg-white/10 rounded-full mr-2 active:bg-white/20"
          >
            <Text className="text-starlight font-bold text-xs">{rate}x</Text>
          </Pressable>

          <Pressable onPress={handleClose} className="p-2">
            <X color="#94a3b8" size={20} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};
