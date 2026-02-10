import { usePathname, useRouter } from 'expo-router';
import { Pause, Play, X } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useAudioPlayerStore } from '../../stores/audioPlayerStore';
import { themeClasses } from '../../theme/classes';

// Opções de velocidade disponíveis
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const MiniAudioPlayer = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const {
    currentUri,
    isMinimized,
    isPlaying,
    isLoading,
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
    // 1. Navega PRIMEIRO (se necessário) para garantir que a galeria esteja montada antes de maximizar
    const isOnGallery = pathname?.includes('/studio/gallery');

    if (!isOnGallery) {
        if (chatId) {
            // Se tiver artifactId, passa na URL
            const url = artifactId
                ? `/studio/gallery?chatId=${chatId}&openArtifactId=${artifactId}`
                : `/studio/gallery?chatId=${chatId}`;

            try {
                router.push(url as any);
                // Pequeno delay para permitir a montagem da tela antes de disparar o maximize
                // Isso garante que o useEffect da Galeria capture a mudança de isMinimized
                setTimeout(() => maximize(), 300);
            } catch (error) {
                console.error('Navigation error:', error);
            }
        }
    } else {
        // Já estamos na galeria, só maximiza
        maximize();
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
      className={`absolute left-0 right-0 z-50`}
    >
      <View className={`${themeClasses.surface} shadow-lg overflow-hidden`}>
        {/* Progress Bar Line */}
        <View className="h-1 bg-gray-100 dark:bg-white/10 w-full">
          <View style={{ width: `${progressPercent}%` }} className="h-full bg-cosmic-purple" />
        </View>

        <View className="flex-row items-center p-3">
          <Pressable
            onPress={isPlaying ? pause : resume}
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${themeClasses.softSurface}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#818cf8" size="small" />
            ) : isPlaying ? (
              <Pause color={colorScheme === 'dark' ? '#fff' : '#020617'} size={20} fill={colorScheme === 'dark' ? '#fff' : '#020617'} />
            ) : (
              <Play color={colorScheme === 'dark' ? '#fff' : '#020617'} size={20} fill={colorScheme === 'dark' ? '#fff' : '#020617'} />
            )}
          </Pressable>

          <Pressable className="flex-1" onPress={handlePress}>
            <Text className={`${themeClasses.textPrimary} font-bold text-sm`} numberOfLines={1}>{title || 'Áudio'}</Text>
            <Text className={`${themeClasses.textMuted} text-xs`}>Toque para expandir</Text>
          </Pressable>

          {/* Speed Control */}
          <Pressable
            onPress={handleSpeedChange}
            className={`px-2 py-1 rounded-full mr-2 ${themeClasses.softSurface} active:bg-gray-200 dark:active:bg-white/20`}
          >
            <Text className={`${themeClasses.textPrimary} font-bold text-xs`}>{rate}x</Text>
          </Pressable>

          <Pressable onPress={handleClose} className="p-2" hitSlop={10}>
            <X color="#94a3b8" size={20} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};
