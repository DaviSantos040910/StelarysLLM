import client from '../api/client';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

interface LoginResponse {
  token: string;
  refresh: string;
  user: User;
}

interface RegisterResponse {
  message: string;
}

export const authService = {
  login: async (identifier: string, password: string): Promise<LoginResponse> => {
    const response = await client.post<LoginResponse>('/auth/login/', { identifier, password });
    const { token, refresh } = response.data;
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('refresh', refresh);
    return response.data;
  },

  signup: async (userData: Partial<User> & { password: string }): Promise<RegisterResponse> => {
    const response = await client.post<RegisterResponse>('/auth/register/', userData);
    return response.data;
  },

  claimGuest: async (guestId: string): Promise<void> => {
    // Explicitly pass X-Guest-Id because client.ts only injects it if NO token is present.
    // Here we are logged in (have token), so we must manually attach the header.
    await client.post('/api/v1/accounts/claim_guest/', {}, {
      headers: {
        'X-Guest-Id': guestId
      }
    });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refresh');
  },
};
