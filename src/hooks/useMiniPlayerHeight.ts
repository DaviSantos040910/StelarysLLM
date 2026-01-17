import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayerStore } from '../stores/audioPlayerStore';

/**
 * Altura do mini player (card + padding)
 * Card: ~60px (h-1 progress + p-3 content)
 * Padding: safe area bottom no iOS, 8px no Android
 */
const MINI_PLAYER_CARD_HEIGHT = 60;

/**
 * Hook que retorna a altura do mini player se ele estiver visível
 * Use isso para adicionar padding/margin em elementos que ficam no bottom da tela
 */
export const useMiniPlayerHeight = () => {
    const insets = useSafeAreaInsets();
    // Seleciona apenas os campos necessários para evitar re-renders desnecessários
    // mas garantir que re-render aconteça quando esses valores mudarem
    const currentUri = useAudioPlayerStore(state => state.currentUri);
    const isMinimized = useAudioPlayerStore(state => state.isMinimized);

    const isVisible = Boolean(currentUri && isMinimized);

    if (!isVisible) return 0;

    const bottomPadding = Platform.OS === 'ios' ? insets.bottom : 8;
    return MINI_PLAYER_CARD_HEIGHT + bottomPadding;
};

/**
 * Retorna se o mini player está visível
 */
export const useMiniPlayerVisible = () => {
    const currentUri = useAudioPlayerStore(state => state.currentUri);
    const isMinimized = useAudioPlayerStore(state => state.isMinimized);
    return Boolean(currentUri && isMinimized);
};
