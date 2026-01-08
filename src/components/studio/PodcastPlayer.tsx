import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { Play, Pause, RotateCcw, FastForward, Rewind } from 'lucide-react-native';
import TrackPlayer, { usePlaybackState, useProgress, State } from 'react-native-track-player';
import { useSetupPlayer } from '../../hooks/useSetupPlayer';

interface Props {
  uri?: string;
  title: string;
}

export const PodcastPlayer: React.FC<Props> = ({ uri, title }) => {
  const isPlayerReady = useSetupPlayer();
  const playbackState = usePlaybackState();
  const progress = useProgress();
  const [isLoading, setIsLoading] = useState(false);

  // Helper to check if playing based on State enum or string
  const isPlaying = playbackState.state === State.Playing;

  useEffect(() => {
    const loadTrack = async () => {
      if (!isPlayerReady || !uri) return;

      setIsLoading(true);
      try {
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: 'podcast',
          url: uri,
          title: title,
          artist: 'Stelarys AI',
          // artwork: require('path/to/image') // Optional: Add artwork
        });
        // We don't auto-play to respect user context, or we could:
        // await TrackPlayer.play();
      } catch (error) {
        console.error('Error loading track:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrack();

    return () => {
        // Cleanup on unmount
        TrackPlayer.reset();
    };
  }, [isPlayerReady, uri, title]);

  const togglePlayback = async () => {
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const handleSeek = async (value: number) => {
    await TrackPlayer.seekTo(value);
  };

  const handleSkip = async (seconds: number) => {
    const newPos = progress.position + seconds;
    await TrackPlayer.seekTo(Math.max(0, Math.min(newPos, progress.duration)));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isPlayerReady) {
      return (
          <View className="flex-1 items-center justify-center bg-space-dark">
              <ActivityIndicator color="#818cf8" size="large" />
              <Text className="text-gray-500 mt-4">Inicializando Player...</Text>
          </View>
      );
  }

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
                maximumValue={progress.duration}
                value={progress.position}
                onSlidingComplete={handleSeek}
                minimumTrackTintColor="#818cf8"
                maximumTrackTintColor="rgba(255,255,255,0.1)"
                thumbTintColor="#818cf8"
            />
            <View className="flex-row justify-between px-2">
                <Text className="text-gray-500 text-xs font-mono">{formatTime(progress.position)}</Text>
                <Text className="text-gray-500 text-xs font-mono">{formatTime(progress.duration)}</Text>
            </View>
        </View>

        {/* Controls */}
        <View className="flex-row items-center gap-8 mt-4">
             <Pressable onPress={() => handleSkip(-15)} className="p-4 bg-white/5 rounded-full active:bg-white/10">
                 <RotateCcw size={24} color="#fff" />
             </Pressable>

             <Pressable
                onPress={togglePlayback}
                className="w-20 h-20 bg-cosmic-purple rounded-full items-center justify-center shadow-lg shadow-indigo-500/50 active:opacity-90"
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
