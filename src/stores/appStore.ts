import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  hasSeenOnboarding: boolean;
  isLoading: boolean;

  setHasSeenOnboarding: (seen: boolean) => Promise<void>;
  checkOnboarding: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  hasSeenOnboarding: false,
  isLoading: true,

  setHasSeenOnboarding: async (seen: boolean) => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', JSON.stringify(seen));
      set({ hasSeenOnboarding: seen });
    } catch (error) {
      console.error('Failed to save onboarding status', error);
    }
  },

  checkOnboarding: async () => {
    set({ isLoading: true });
    try {
      const value = await AsyncStorage.getItem('hasSeenOnboarding');
      if (value !== null) {
        set({ hasSeenOnboarding: JSON.parse(value) });
      } else {
        set({ hasSeenOnboarding: false });
      }
    } catch (error) {
      console.error('Failed to load onboarding status', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
