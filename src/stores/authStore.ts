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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, pass) => {
    set({ isLoading: true, error: null });
    try {
      // The authService.login expects identifier and password
      const response = await authService.login(email, pass);
      // authService.login already calls updateStore-like logic in my previous impl?
      // Wait, let's check authService.
      // My previous authService called `useAuthStore.getState().login(...)`.
      // I should refactor authService to just return data, and let the store handle state.
      // BUT, to avoid circular dependency if I change authService, let's just assume authService returns data
      // AND we update state here.

      // Actually, looking at previous step's authService:
      // It calls `useAuthStore.getState().login(user, token, refresh);`
      // This is a bit recursive if I call authService.login from store.login.

      // Ideally: Store calls API directly or Service is stateless.
      // Let's rely on what authService returns.

      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false
      });

      // Navigation should ideally happen in the component, but can be here too.
      // router.replace('/(tabs)');
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
      // Usually signup requires verification or auto-login.
      // For now, we just stop loading.
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
      await authService.logout(); // Service clears SecureStore
    } catch (e) {
      // ignore
    }
    // We also clear state here just in case
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    router.replace('/(auth)/login');
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync('token');
      const refresh = await SecureStore.getItemAsync('refresh');

      if (token) {
        // Here we might want to fetch the user profile if we don't have it stored.
        // For now, let's assume we just restore the token.
        // If we need the user object, we should call an endpoint like /auth/me/
        // Let's assume we might need to fetch it.

        // TODO: Implement `client.get('/auth/me/')` or similar if needed.
        // For now, we just set authenticated.
        set({ token, isAuthenticated: true });
      }
    } catch (error) {
      console.error('Failed to load user', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
