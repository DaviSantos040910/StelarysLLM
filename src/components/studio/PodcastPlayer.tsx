import Slider from '@react-native-community/slider';
import { FastForward, Pause, Play, RotateCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BASE_URL } from '../../api/client';
import { useAudioPlayerStore } from '../../stores/audioPlayerStore';

// Opções de velocidade disponíveis
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface Props {
  uri?: string;
  title: string;
  artifactId?: number;
  chatId?: string;
}

export const PodcastPlayer: React.FC<Props> = ({ uri, title, artifactId, chatId }) => {
  // ---------- Store (seletores granulares para evitar re-renders desnecessários) ----------
  const sound = useAudioPlayerStore(state => state.sound);
  const currentUri = useAudioPlayerStore(state => state.currentUri);
  const storePosition = useAudioPlayerStore(state => state.position);
  const storeDuration = useAudioPlayerStore(state => state.duration);
  const storeIsPlaying = useAudioPlayerStore(state => state.isPlaying);
  const storeIsLoading = useAudioPlayerStore(state => state.isLoading);
  const rate = useAudioPlayerStore(state => state.rate);
  const isMinimized = useAudioPlayerStore(state => state.isMinimized);

  // Actions
  const play = useAudioPlayerStore(state => state.play);
  const pause = useAudioPlayerStore(state => state.pause);
  const resume = useAudioPlayerStore(state => state.resume);
  const seek = useAudioPlayerStore(state => state.seek);
  const setRate = useAudioPlayerStore(state => state.setRate);

  // ---------- Estado local para controle do slider ----------
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  // ---------- Valores derivados ----------
  const isCurrent = currentUri === uri;
  const position = isCurrent ? storePosition / 1000 : 0;
  const duration = isCurrent && storeDuration > 0 ? storeDuration / 1000 : 0;
  const isPlaying = isCurrent && storeIsPlaying;
  const isLoading = storeIsLoading;

  // ---------- Efeitos ----------

  // Inicia reprodução quando o componente monta com um URI válido
  useEffect(() => {
    if (uri && !isCurrent && !storeIsLoading) {
        // Prepend BASE_URL if relative path
        const fullUri = uri.startsWith('/') ? `${BASE_URL}${uri}` : uri;
        play(fullUri, title, artifactId, chatId).catch(console.error);
    }
  }, [uri]); // Dependência apenas do uri para evitar loops

  // Cleanup: pausa ao desmontar se não estiver minimizado
  useEffect(() => {
    return () => {
      const state = useAudioPlayerStore.getState();
      if (!state.isMinimized && state.sound) {
        state.pause().catch(console.error);
      }
    };
  }, []);

  // ---------- Handlers ----------

  const togglePlayback = useCallback(async () => {
    try {
      if (isLoading) return;
      // Se já está tocando, pausa
      if (storeIsPlaying) {
        await pause();
        return;
      }
      // Caso contrário, tenta reproduzir (mesmo que já seja o atual)
      if (uri) {
        const fullUri = uri.startsWith('/') ? `${BASE_URL}${uri}` : uri;
        await play(fullUri, title, artifactId, chatId);
      }
    } catch (error) {
      console.error('Playback toggle error:', error);
    }
  }, [storeIsPlaying, uri, title, artifactId, chatId, play, pause]);

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
    setSeekValue(position);
  }, [position]);

  const handleSeekChange = useCallback((value: number) => {
    setSeekValue(value);
  }, []);

  const handleSeekComplete = useCallback(async (value: number) => {
    setIsSeeking(false);
    if (isCurrent) {
      try {
        await seek(value * 1000);
      } catch (error) {
        console.error('Seek error:', error);
      }
    }
  }, [isCurrent, seek]);

  const handleSkip = useCallback(async (seconds: number) => {
    if (!uri) return;
    try {
      const currentMs = storePosition;
      const newPos = Math.max(0, Math.min(currentMs + seconds * 1000, storeDuration));
      await seek(newPos);
    } catch (error) {
      console.error('Skip error:', error);
    }
  }, [uri, storePosition, storeDuration, seek]);

  const handleSpeedChange = useCallback(async () => {
    try {
      const currentIndex = SPEED_OPTIONS.indexOf(rate);
      const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
      await setRate(SPEED_OPTIONS[nextIndex]);
    } catch (error) {
      console.error('Speed change error:', error);
    }
  }, [rate, setRate]);

  // ---------- Helpers ----------

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Usa valor local durante o seek, caso contrário usa a posição real
  const displayPosition = isSeeking ? seekValue : position;

  // ---------- Render ----------

  return (
    <View className="flex-1 bg-space-dark items-center justify-center p-8">
      {/* Cover Art */}
      <View className="w-64 h-64 bg-space-light rounded-3xl border border-white/10 shadow-2xl items-center justify-center mb-8">
        <View className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl items-center justify-center">
          <Text className="text-6xl">🎧</Text>
        </View>
      </View>

      {/* Title */}
      <Text className="text-starlight text-2xl font-bold text-center mb-2" numberOfLines={2}>
        {title}
      </Text>
      <Text className="text-gray-400 text-sm font-medium mb-6">AI Audio Overview</Text>

      {/* Speed Control */}
      <Pressable
        onPress={handleSpeedChange}
        className="px-4 py-2 bg-white/10 rounded-full mb-6 active:bg-white/20"
      >
        <Text className="text-starlight font-bold text-sm">{rate}x</Text>
      </Pressable>

      {/* Progress */}
      <View className="w-full mb-2">
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 1}
          value={displayPosition}
          onSlidingStart={handleSeekStart}
          onValueChange={handleSeekChange}
          onSlidingComplete={handleSeekComplete}
          minimumTrackTintColor="#818cf8"
          maximumTrackTintColor="rgba(255,255,255,0.1)"
          thumbTintColor="#818cf8"
          disabled={!uri || isLoading}
        />
        <View className="flex-row justify-between px-2">
          <Text className="text-gray-500 text-xs font-mono">{formatTime(displayPosition)}</Text>
          <Text className="text-gray-500 text-xs font-mono">{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View className="flex-row items-center gap-8 mt-4">
        <Pressable
          onPress={() => handleSkip(-15)}
          className="p-4 bg-white/5 rounded-full active:bg-white/10"
          disabled={!uri || isLoading}
        >
          <RotateCcw size={24} color={uri && !isLoading ? "#fff" : "#666"} />
        </Pressable>

        <Pressable
          onPress={togglePlayback}
          className={`w-20 h-20 rounded-full items-center justify-center shadow-lg shadow-indigo-500/50 active:opacity-90 ${isLoading ? 'bg-gray-600' : storeIsPlaying ? 'bg-cosmic-purple' : 'bg-gray-700'
            }`}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : storeIsPlaying ? (
            <Pause size={32} color="#fff" fill="#fff" />
          ) : (
            <Play size={32} color="#fff" fill="#fff" />
          )}
        </Pressable>

        <Pressable
          onPress={() => handleSkip(30)}
          className="p-4 bg-white/5 rounded-full active:bg-white/10"
          disabled={!uri || isLoading}
        >
          <FastForward size={24} color={uri && !isLoading ? "#fff" : "#666"} />
        </Pressable>
      </View>
    </View>
  );
};
