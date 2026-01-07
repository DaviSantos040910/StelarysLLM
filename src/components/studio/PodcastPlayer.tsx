import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { Play, Pause, RotateCcw, FastForward, Rewind } from 'lucide-react-native';

interface Props {
  uri?: string;
  title: string;
}

export const PodcastPlayer: React.FC<Props> = ({ uri, title }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
        sound?.unloadAsync();
    };
  }, [sound]);

  const loadSound = async () => {
      if (!uri) return;
      setIsLoading(true);
      try {
          const { sound: newSound, status } = await Audio.Sound.createAsync(
              { uri },
              { shouldPlay: true },
              onPlaybackStatusUpdate
          );
          setSound(newSound);
          if (status.isLoaded) {
             setDuration(status.durationMillis || 0);
          }
          setIsLoading(false);
      } catch (e) {
          console.error(e);
          setIsLoading(false);
      }
  };

  const onPlaybackStatusUpdate = (status: any) => {
      if (status.isLoaded) {
          setPosition(status.positionMillis);
          setDuration(status.durationMillis || duration);
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
              setIsPlaying(false);
              setPosition(0);
          }
      }
  };

  const handlePlayPause = async () => {
      if (!sound) await loadSound();
      else {
          if (isPlaying) await sound.pauseAsync();
          else await sound.playAsync();
      }
  };

  const handleSeek = async (value: number) => {
      if (sound) await sound.setPositionAsync(value);
  };

  const handleSkip = async (amount: number) => {
      if (sound) {
          const newPos = Math.max(0, Math.min(position + amount, duration));
          await sound.setPositionAsync(newPos);
      }
  };

  const formatTime = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View className="flex-1 bg-space-dark items-center justify-center p-8">
        {/* Cover Art */}
        <View className="w-64 h-64 bg-space-light rounded-3xl border border-white/10 shadow-2xl items-center justify-center mb-8">
             <View className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl items-center justify-center">
                 <Text className="text-6xl">🎧</Text>
             </View>
        </View>

        {/* Title */}
        <Text className="text-starlight text-2xl font-bold text-center mb-2">{title}</Text>
        <Text className="text-gray-400 text-sm font-medium mb-10">AI Audio Overview</Text>

        {/* Progress */}
        <View className="w-full mb-2">
            <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0}
                maximumValue={duration}
                value={position}
                onSlidingComplete={handleSeek}
                minimumTrackTintColor="#818cf8"
                maximumTrackTintColor="rgba(255,255,255,0.1)"
                thumbTintColor="#818cf8"
            />
            <View className="flex-row justify-between px-2">
                <Text className="text-gray-500 text-xs font-mono">{formatTime(position)}</Text>
                <Text className="text-gray-500 text-xs font-mono">{formatTime(duration)}</Text>
            </View>
        </View>

        {/* Controls */}
        <View className="flex-row items-center gap-8 mt-4">
             <Pressable onPress={() => handleSkip(-15000)} className="p-4 bg-white/5 rounded-full">
                 <RotateCcw size={24} color="#fff" />
             </Pressable>

             <Pressable
                onPress={handlePlayPause}
                className="w-20 h-20 bg-cosmic-purple rounded-full items-center justify-center shadow-lg shadow-indigo-500/50"
             >
                 {isLoading ? (
                     <ActivityIndicator color="#fff" size="large" />
                 ) : isPlaying ? (
                     <Pause size={32} color="#fff" fill="#fff" />
                 ) : (
                     <Play size={32} color="#fff" fill="#fff" className="ml-1" />
                 )}
             </Pressable>

             <Pressable onPress={() => handleSkip(30000)} className="p-4 bg-white/5 rounded-full">
                 <FastForward size={24} color="#fff" />
             </Pressable>
        </View>
    </View>
  );
};
