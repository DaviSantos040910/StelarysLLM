import { Audio } from 'expo-av';
import { create } from 'zustand';

interface AudioPlayerState {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  isMinimized: boolean;
  isLoading: boolean;
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
    // Evita chamadas duplicadas se já estiver carregando o MESMO uri
    if (get().isLoading && get().currentUri === uri) return;

    const { sound: oldSound, close } = get();

    // Lógica de Resume (se for o mesmo áudio já carregado)
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

    // 1. Limpa o som anterior (isso reseta o estado, então fazemos ANTES de setar o novo)
    if (oldSound) {
      await close();
    }

    // 2. Define estado inicial IMEDIATAMENTE (Feedback Visual)
    set({
      isLoading: true,
      currentUri: uri, // Otimista: assume que esse é o atual
      title: title || 'Carregando áudio...',
      duration: 0,
      position: 0,
      isPlaying: false,
      isMinimized: false,
      artifactId: artifactId || null,
      chatId: chatId || null
    });

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // 3. Race Condition com Timeout de 15s para evitar spinner eterno
      const loadPromise = Audio.Sound.createAsync(
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
              // Reinicia posição para replay
              get().sound?.stopAsync();
            }
          }
        }
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao carregar áudio')), 15000)
      );

      const result = await Promise.race([loadPromise, timeoutPromise]) as { sound: Audio.Sound, status: any };
      const { sound, status } = result;

      // 4. Sucesso
      set({
        sound,
        isLoading: false,
        isPlaying: true,
        duration: status.durationMillis || 0
      });

    } catch (error) {
      console.error('Failed to play audio:', error);
      // Mantemos o currentUri para permitir "Tentar Novamente", mas paramos o loading
      set({ isLoading: false, isPlaying: false });
      alert('Não foi possível reproduzir o áudio. Verifique sua conexão.');
    }
  },

  pause: async () => {
    const { sound } = get();
    try {
      if (sound) await sound.pauseAsync();
    } catch (error) {
      console.error('Error pausing:', error);
    }
    set({ isPlaying: false });
  },

  resume: async () => {
    const { sound } = get();
    try {
      if (sound) {
        await sound.playAsync();
        set({ isPlaying: true });
      }
    } catch (error) {
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
    // Feedback imediato na UI
    set({ isPlaying: false, isLoading: false });

    try {
      if (sound) {
        // Tenta parar antes de descarregar
        try { await sound.stopAsync(); } catch (e) {}
        await sound.unloadAsync();
      }
    } catch (error) {
      console.error('Error closing sound:', error);
    }

    // Limpeza total
    set({
      sound: null,
      currentUri: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      isMinimized: false,
      isLoading: false
    });
  }
}));
