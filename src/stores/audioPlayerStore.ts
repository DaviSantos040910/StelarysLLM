import { Audio } from 'expo-av';
import { create } from 'zustand';
import { getAuthHeaders } from '../api/authHeaders';

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
  playSessionId: number;

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
  playSessionId: 0,

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

    // Start New Session
    const currentSessionId = get().playSessionId + 1;

    // 2. Define estado inicial IMEDIATAMENTE (Feedback Visual)
    set({
      playSessionId: currentSessionId,
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

      const headers = await getAuthHeaders();

      // 3. Race Condition com Timeout de 15s para evitar spinner eterno
      // IMPORTANT: shouldPlay: false to prevent ghost audio if timeout occurs
      const loadPromise = Audio.Sound.createAsync(
        { uri, headers }, // Inject headers
        { shouldPlay: false, rate: get().rate, shouldCorrectPitch: true },
        (status) => {
          // Status Update Callback (runs frequently)
          // Must check session ID to prevent zombie updates
          if (get().playSessionId !== currentSessionId) return;

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

      // Aguarda o resultado
      const result = await Promise.race([loadPromise, timeoutPromise]) as { sound: Audio.Sound, status: any };
      const { sound, status } = result;

      // Session Guard: Check if user cancelled/navigated/stopped while loading
      if (get().playSessionId !== currentSessionId) {
        console.log("Audio loaded but session expired (orphaned). Unloading.");
        await sound.unloadAsync();
        return;
      }

      // 4. Sucesso (Sessão Válida) -> Agora damos play manual
      await sound.playAsync();

      set({
        sound,
        isLoading: false,
        isPlaying: true,
        duration: status.durationMillis || 0
      });

    } catch (error) {
      // Se for timeout, o loadPromise ainda pode resolver depois.
      // A Session Guard acima (dentro do `then` ou após `await`) deve tratar.
      // Se loadPromise resolver APÓS este catch, precisamos garantir que não toque.
      // Como Audio.Sound.createAsync tem `shouldPlay: true`, ele toca sozinho se não descarregado.
      // O `loadPromise` original não tem como ser cancelado externamente.
      // Mas o `createAsync` retorna o sound object.
      // Se cair no catch (Timeout), o `result` é indefinido aqui.

      console.error('Failed to play audio:', error);

      // Se a sessão ainda for a mesma (ninguém clicou em outro play), marca como falha/parado
      if (get().playSessionId === currentSessionId) {
        set({ isLoading: false, isPlaying: false });
      }

      // Nota: Se o `loadPromise` terminar depois, ele retornará o `sound`.
      // Mas como não temos referência a ele AQUI (no catch do race), não podemos dar unload.
      // POREM, o `Audio.Sound.createAsync` já foi disparado.
      // Solução: O `createAsync` foi disparado. Não temos a ref dele se o timeout ganhar.
      // Isso é um problema da API do Expo.
      // Workaround: Não usar `shouldPlay: true` no createAsync. Dar play manual APÓS a verificação de sessão.
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
        try { await sound.stopAsync(); } catch (e) { }
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
      isLoading: false,
      // We do NOT clear chatId here if we want the "Stop" button to remain active
      // but in "stopped" state. However, closing usually means "gone".
      // Let's keep cleaning up to ensure fresh state.
      chatId: null
    });
  }
}));
