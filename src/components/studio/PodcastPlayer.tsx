import React, { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react-native';
import { useAudioPlayerStore } from '../../stores/audioPlayerStore';

interface Props {
  uri?: string;
  title: string;
}

export const PodcastPlayer: React.FC<Props> = ({ uri, title }) => {
  const {
    play,
    pause,
    resume,
    seek,
    position: storePos,
    duration: storeDur,
    isPlaying: storeIsPlaying,
    currentUri
  } = useAudioPlayerStore();

  const isCurrent = currentUri === uri;
  // If not current, we are loading or idle.
  // We use store state only if isCurrent.

  const position = isCurrent ? storePos / 1000 : 0;
  const duration = isCurrent && storeDur > 0 ? storeDur / 1000 : 0;
  const isPlaying = isCurrent && storeIsPlaying;
  // If we are current, we are "ready" effectively.
  // But we might want to show loading if duration is 0?
  const isLoading = isCurrent && duration === 0 && storeIsPlaying;

  useEffect(() => {
    if (uri && !isCurrent) {
        play(uri, title);
    }
  }, [uri, isCurrent]);

  const togglePlayback = async () => {
    if (isPlaying) {
      await pause();
    } else if (isCurrent) {
      await resume();
    } else if (uri) {
      await play(uri, title);
    }
  };

  const handleSeek = async (value: number) => {
    if (isCurrent) {
      await seek(value * 1000);
    }
  };

  const handleSkip = async (seconds: number) => {
    if (isCurrent) {
        const currentMs = storePos;
        const newPos = Math.max(0, Math.min(currentMs + (seconds * 1000), storeDur));
        await seek(newPos);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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
                disabled={!isCurrent}
            />
            <View className="flex-row justify-between px-2">
                <Text className="text-gray-500 text-xs font-mono">{formatTime(position)}</Text>
                <Text className="text-gray-500 text-xs font-mono">{formatTime(duration)}</Text>
            </View>
        </View>

        {/* Controls */}
        <View className="flex-row items-center gap-8 mt-4">
             <Pressable onPress={() => handleSkip(-15)} className="p-4 bg-white/5 rounded-full active:bg-white/10">
                 <RotateCcw size={24} color="#fff" />
             </Pressable>

             <Pressable
                onPress={togglePlayback}
                className={`w-20 h-20 rounded-full items-center justify-center shadow-lg shadow-indigo-500/50 active:opacity-90 ${isCurrent ? 'bg-cosmic-purple' : 'bg-gray-700'}`}
                disabled={!isCurrent}
             >
                 {isLoading ? (
                     <ActivityIndicator color="#fff" size="large" />
                 ) : isPlaying ? (
                     <Pause size={32} color="#fff" fill="#fff" />
                 ) : (
                     <Play size={32} color="#fff" fill="#fff" className="ml-1" />
                 )}
             </Pressable>

             <Pressable onPress={() => handleSkip(30)} className="p-4 bg-white/5 rounded-full active:bg-white/10">
                 <FastForward size={24} color="#fff" />
             </Pressable>
        </View>
    </View>
  );
};
