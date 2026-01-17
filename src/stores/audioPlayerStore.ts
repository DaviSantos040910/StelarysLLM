import { Audio } from 'expo-av';
import { create } from 'zustand';

interface AudioPlayerState {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  isMinimized: boolean;
  isLoading: boolean; // NOVO: Estado explícito
  currentUri: string | null;
  duration: number;
  position: number;
  rate: number;
  title: string | null;
  artifactId: number | null;
  chatId: string | null;

  play: (uri: string, title?: string, artifactId?: number, chatId?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  minimize: () => void;
  maximize: () => void;
  close: () => Promise<void>;
}

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => ({
  sound: null,
  isPlaying: false,
  isMinimized: false,
  isLoading: false,
  currentUri: null,
  duration: 0,
  position: 0,
  rate: 1.0,
  title: null,
  artifactId: null,
  chatId: null,

  play: async (uri, title, artifactId, chatId) => {
    const { sound: oldSound, close } = get();

    // Se já estiver tocando esse URI, apenas resume e maximiza
    if (get().currentUri === uri && oldSound) {
      try {
        await oldSound.playAsync();
        set({ isPlaying: true, isMinimized: false, isLoading: false });
      } catch (error) {
         console.error('Error resuming existing sound:', error);
         set({ isPlaying: false, isLoading: false });
      }
      return;
    }

    set({ isLoading: true }); // Inicia loading

    if (oldSound) {
      await close();
    }

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
        { shouldPlay: true, rate: get().rate, shouldCorrectPitch: true },
        (status) => {
          if (status.isLoaded) {
            set({
              position: status.positionMillis,
              duration: status.durationMillis || 0,
              isPlaying: status.isPlaying,
            });
            if (status.didJustFinish) {
              set({ isPlaying: false, position: 0 });
              sound.setPositionAsync(0);
            }
          }
        }
      );

      set({
        sound,
        currentUri: uri,
        isPlaying: true,
        isMinimized: false,
        title: title || 'Audio Playing',
        artifactId: artifactId || null,
        chatId: chatId || null,
        isLoading: false // Sucesso
      });
    } catch (error) {
      console.error('Failed to play audio', error);
      set({ isLoading: false, isPlaying: false }); // Garante que destrava a UI em caso de erro
    }
  },

  pause: async () => {
    const { sound } = get();
    try {
      if (sound) {
        await sound.pauseAsync();
      }
    } catch (error) {
      console.error('Error pausing sound:', error);
    }
    // Always update UI state
    set({ isPlaying: false });
  },

  resume: async () => {
    const { sound } = get();
    try {
      if (sound) {
        await sound.playAsync();
        set({ isPlaying: true });
      } else {
         // Fallback: if no sound object but UI thinks we can resume, force sync
         set({ isPlaying: false });
      }
    } catch (error) {
      console.error('Error resuming sound:', error);
      set({ isPlaying: false });
    }
  },

  seek: async (pos) => {
    const { sound } = get();
    if (sound) await sound.setPositionAsync(pos);
  },

  setRate: async (rate) => {
    const { sound } = get();
    if (sound) await sound.setRateAsync(rate, true);
    set({ rate });
  },

  minimize: () => set({ isMinimized: true }),
  maximize: () => set({ isMinimized: false }),

  close: async () => {
    const { sound } = get();
    set({ isPlaying: false, isLoading: false }); // Reset imediato

    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }
      }
    } catch (error) {
      console.error('Error stopping/unloading sound:', error);
    }

    set({
      sound: null,
      currentUri: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      isMinimized: false,
      artifactId: null,
      chatId: null,
      title: null,
      isLoading: false
    });
  }
}));
