import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string, refresh: string) => void;
  logout: () => void;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async (user, token, refresh) => {
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('refresh', refresh);
    set({ user, token, isAuthenticated: true });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refresh');
    set({ user: null, token: null, isAuthenticated: false });
  },
  loadToken: async () => {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      set({ token, isAuthenticated: true });
    }
  },
}));
