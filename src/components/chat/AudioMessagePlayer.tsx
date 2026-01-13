import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { Play, Pause } from 'lucide-react-native';

interface AudioMessagePlayerProps {
  uri: string;
  duration?: number; // In milliseconds
  isUser?: boolean;
}

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({ uri, duration, isUser }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0); // Current position in ms
  const [localDuration, setLocalDuration] = useState(duration || 0); // Total duration
  const [isLoading, setIsLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadSound = async () => {
    if (sound) return sound;

    setIsLoading(true);
    try {
      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, rate: playbackSpeed, shouldCorrectPitch: true },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
      setIsPlaying(true); // Auto-play on first load

      if (status.isLoaded && status.durationMillis) {
          setLocalDuration(status.durationMillis);
      }
      setIsLoading(false);
      return newSound;
    } catch (error) {
      console.error('Error loading sound', error);
      setIsLoading(false);
      return null;
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setLocalDuration(status.durationMillis || localDuration);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const handlePlayPause = async () => {
    if (!sound) {
      await loadSound();
    } else {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        if (position >= localDuration) {
             await sound.replayAsync();
        } else {
             await sound.playAsync();
        }
      }
    }
  };

  const handleSeek = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value);
    }
  };

  const handleSpeedToggle = async () => {
    const nextSpeed = playbackSpeed === 1.0 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
    setPlaybackSpeed(nextSpeed);
    if (sound) {
        await sound.setRateAsync(nextSpeed, true);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const iconColor = isUser ? '#FFFFFF' : '#818cf8';
  const trackColor = isUser ? 'rgba(255,255,255,0.3)' : 'rgba(129, 140, 248, 0.3)';
  const thumbColor = isUser ? '#FFFFFF' : '#818cf8';
  const activeTrackColor = isUser ? '#FFFFFF' : '#818cf8';

  return (
    <View className="flex-row items-center w-full min-w-[200px] py-1">
      <Pressable onPress={handlePlayPause} className="p-2 mr-1">
        {isLoading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : isPlaying ? (
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
        />
      </View>

      <Text className={`text-xs ml-2 font-mono ${isUser ? 'text-white' : 'text-gray-400'}`}>
        {formatTime(position)} / {formatTime(localDuration)}
      </Text>

      <Pressable
        onPress={handleSpeedToggle}
        className={`ml-2 px-2 py-1 rounded-md ${isUser ? 'bg-white/20' : 'bg-cosmic-purple/10'}`}
      >
        <Text className={`text-[10px] font-bold ${isUser ? 'text-white' : 'text-cosmic-purple'}`}>
            {playbackSpeed}x
        </Text>
      </Pressable>
    </View>
  );
};
