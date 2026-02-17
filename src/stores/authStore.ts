import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { router } from 'expo-router';

// Helper to handle storage across platforms
const storage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  }
};

// We replicate isLikelyJwt logic or import it (circular dependency risk if imported from client.ts which imports store)
// Safe to duplicate small helper
const isLikelyJwt = (token: string | null): boolean => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(p => p.length > 0);
};

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

      // Automatic Guest Claim
      const { guestId } = get();
      if (guestId) {
        try {
          if (__DEV__) console.log('[Auth] Attempting to claim guest session:', guestId);
          await authService.claimGuest(guestId);
          if (__DEV__) console.log('[Auth] Guest session claimed successfully');

          // Clear guestId from store/storage as it's merged
          set({ guestId: null });
          await storage.deleteItem('guest_id');
        } catch (claimError: any) {
          // If 409 (Already Claimed) or 204 (No Content), treat as success
          if (claimError.response?.status === 409 || claimError.response?.status === 204) {
             set({ guestId: null });
             await storage.deleteItem('guest_id');
          } else {
             console.error('[Auth] Failed to claim guest session', claimError);
          }
          // Do not block login
        }
      }

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
      let guestId = await storage.getItem('guest_id');
      if (!guestId) {
        guestId = Crypto.randomUUID();
        await storage.setItem('guest_id', guestId);
      }
      set({ guestId });

      // 2. Handle User Token
      let token = await storage.getItem('token');

      // Hardening: Validate token format before trusting it
      if (token && !isLikelyJwt(token)) {
          await storage.deleteItem('token');
          token = null;
      }

      if (token) {
        set({ token, isAuthenticated: true });
        try {
            const user = await userService.getProfile();
            set({ user, isAuthenticated: true });
        } catch (profileError) {
             // If token is invalid/expired, clear it
             await storage.deleteItem('token');
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
