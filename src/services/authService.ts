import client from '../api/client';
import { useAuthStore } from '../stores/authStore';
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
    const { token, refresh, user } = response.data;
    useAuthStore.getState().login(user, token, refresh);
    return response.data;
  },

  signup: async (userData: Partial<User> & { password: string }): Promise<RegisterResponse> => {
    // The backend expects specific fields.
    // Based on RegisterView and standard Django User model: username, email, password.
    const response = await client.post<RegisterResponse>('/auth/register/', userData);
    return response.data;
  },

  logout: async () => {
    useAuthStore.getState().logout();
  },
};
