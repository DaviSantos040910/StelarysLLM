import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import { authService } from '../services/authService';
import { router } from 'expo-router';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, pass: string) => Promise<void>;
  signup: (data: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Start as true to prevent flicker
  error: null,

  login: async (email, pass) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(email, pass);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to login',
        isLoading: false
      });
      throw error;
    }
  },

  signup: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await authService.signup(data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to sign up',
        isLoading: false
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } catch (e) {
      // ignore
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    router.replace('/(auth)/login');
  },

  loadUser: async () => {
    // Only set loading if it's not already loading (though it starts as true)
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync('token');

      if (token) {
        set({ token, isAuthenticated: true });
        // Optionally fetch user profile here if needed
      }
    } catch (error) {
      console.error('Failed to load user', error);
      // Ensure we clear auth state on failure
      set({ token: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  setUser: (user: User | null) => {
    set({ user });
  },
}));
