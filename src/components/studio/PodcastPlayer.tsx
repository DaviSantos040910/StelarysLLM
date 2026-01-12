import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';

interface Props {
  uri?: string;
  title: string;
}

export const PodcastPlayer: React.FC<Props> = ({ uri, title }) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const setupAudio = async () => {
      if (!uri) return;

      setIsLoading(true);
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound, status } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          (status) => {
             if (isMounted && status.isLoaded) {
                 setPosition(status.positionMillis / 1000);
                 setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
                 setIsPlaying(status.isPlaying);
                 setIsReady(true);
                 if (status.didJustFinish) {
                     setIsPlaying(false);
                     sound.setPositionAsync(0);
                 }
             }
          }
        );

        soundRef.current = sound;
      } catch (error) {
        console.error("Error loading audio:", error);
        Alert.alert("Erro", "Não foi possível carregar o áudio. Verifique sua conexão.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    setupAudio();

    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [uri]);

  const togglePlayback = async () => {
    if (!soundRef.current || !isReady) return;

    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const handleSeek = async (value: number) => {
    if (!soundRef.current || !isReady) return;
    await soundRef.current.setPositionAsync(value * 1000);
  };

  const handleSkip = async (seconds: number) => {
    if (!soundRef.current || !isReady) return;
    const newPos = Math.max(0, Math.min(position + seconds, duration));
    await soundRef.current.setPositionAsync(newPos * 1000);
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
                disabled={!isReady}
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
                className={`w-20 h-20 rounded-full items-center justify-center shadow-lg shadow-indigo-500/50 active:opacity-90 ${isReady ? 'bg-cosmic-purple' : 'bg-gray-700'}`}
                disabled={!isReady}
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
