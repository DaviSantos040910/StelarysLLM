import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { User } from '../types';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { router } from 'expo-router';

interface AuthState {
  user: User | null;
  token: string | null;
  guestId: string | null;
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
  guestId: null,
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
    // Note: We do NOT clear guestId on logout
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    router.replace('/(auth)/login');
  },

  loadUser: async () => {
    // Only set loading if it's not already loading (though it starts as true)
    set({ isLoading: true });
    try {
      // 1. Handle Guest ID
      let guestId = await SecureStore.getItemAsync('guest_id');
      if (!guestId) {
        guestId = Crypto.randomUUID();
        await SecureStore.setItemAsync('guest_id', guestId);
      }
      set({ guestId });

      // 2. Handle User Token
      const token = await SecureStore.getItemAsync('token');

      if (token) {
        set({ token, isAuthenticated: true });
        try {
            const user = await userService.getProfile();
            set({ user, isAuthenticated: true });
        } catch (profileError) {
             // If token is invalid/expired, clear it
             await SecureStore.deleteItemAsync('token');
             set({ token: null, user: null, isAuthenticated: false });
        }
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
