import React, { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { Play, Pause, ChevronDown } from 'lucide-react-native';
import { useAudioPlayerStore } from '../../stores/audioPlayerStore';
import { themeClasses } from '../../theme/classes';

interface AudioMessagePlayerProps {
  uri: string;
  duration?: number; // In milliseconds
  isUser?: boolean;
}

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({ uri, duration, isUser }) => {
  const {
    currentUri,
    isPlaying: storeIsPlaying,
    position: storePosition,
    duration: storeDuration,
    play,
    pause,
    resume,
    seek,
    rate,
    setRate,
    isMinimized,
    minimize
  } = useAudioPlayerStore();

  const isCurrent = currentUri === uri;
  // If minimized, we show as not playing locally (so user can "maximize" by clicking play, or we show just static)
  // Actually, let's keep it "active" if minimized? No, user wants it to "disappear" locally.
  const isActive = isCurrent && !isMinimized;

  const isPlaying = isActive && storeIsPlaying;
  const position = isActive ? storePosition : 0;
  const localDuration = isActive && storeDuration > 0 ? storeDuration : (duration || 0);
  const playbackSpeed = isActive ? rate : 1.0;

  const handlePlayPause = async () => {
    if (isActive) {
      if (isPlaying) await pause();
      else await resume();
    } else {
      await play(uri, 'Audio Message');
    }
  };

  const handleSeek = async (value: number) => {
    if (isActive) {
      await seek(value);
    }
  };

  const handleSpeedToggle = async () => {
    if (isActive) {
        const nextSpeed = playbackSpeed === 1.0 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
        await setRate(nextSpeed);
    }
  };

  const handleMinimize = () => {
      minimize();
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // If it's a user message, we keep white text/icons (bubble is colored).
  // If it's a bot message, we need to adapt to theme (textPrimary/Secondary).
  // Bot message icon/active color: cosmic-purple in dark, maybe same in light or darker indigo?
  // Let's stick to cosmic-purple for brand consistency in both modes for bot elements.

  const iconColor = isUser ? '#FFFFFF' : '#818cf8';
  const trackColor = isUser ? 'rgba(255,255,255,0.3)' : 'rgba(129, 140, 248, 0.3)';
  const thumbColor = isUser ? '#FFFFFF' : '#818cf8';
  const activeTrackColor = isUser ? '#FFFFFF' : '#818cf8';

  return (
    <View className="flex-row items-center w-full min-w-[200px] py-1">
      <Pressable onPress={handlePlayPause} className="p-2 mr-1">
        {isActive && storeIsPlaying ? (
          <Pause color={iconColor} size={24} fill={iconColor} />
        ) : (
          <Play color={iconColor} size={24} fill={iconColor} />
        )}
      </Pressable>

      <View className="flex-1">
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={0}
          maximumValue={localDuration}
          value={position}
          onSlidingComplete={handleSeek}
          minimumTrackTintColor={activeTrackColor}
          maximumTrackTintColor={trackColor}
          thumbTintColor={thumbColor}
          disabled={!isActive}
        />
      </View>

      <Text className={`text-xs ml-2 font-mono ${isUser ? 'text-white' : themeClasses.textMuted}`}>
        {formatTime(position)} / {formatTime(localDuration)}
      </Text>

      {isActive && (
        <Pressable
            onPress={handleSpeedToggle}
            className={`ml-2 px-2 py-1 rounded-md ${isUser ? 'bg-white/20' : 'bg-cosmic-purple/10'}`}
        >
            <Text className={`text-[10px] font-bold ${isUser ? 'text-white' : 'text-cosmic-purple'}`}>
                {playbackSpeed}x
            </Text>
        </Pressable>
      )}

      {isActive && (
          <Pressable onPress={handleMinimize} className="ml-2 p-1">
              <ChevronDown color={iconColor} size={20} />
          </Pressable>
      )}
    </View>
  );
};
