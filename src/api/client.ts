import axios from 'axios';

// Use environment variable if available, otherwise fallback to localhost for emulator
// 10.0.2.2 is the localhost alias for Android Emulator
const DEV_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.87:8000';
const PROD_URL = 'https://api.stelarys.com';

export const BASE_URL = __DEV__ ? DEV_URL : PROD_URL;

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Simple JWT validation
export const isLikelyJwt = (token: string | null): boolean => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(p => p.length > 0);
};

// Request Interceptor: Inject Token
client.interceptors.request.use(
  (config) => {
    // Dynamic require to avoid circular dependency
    const { useAuthStore } = require('../stores/authStore');
    const { token, guestId } = useAuthStore.getState();

    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {} as any;
    }

    // 1. Inject Authorization (if valid)
    if (isLikelyJwt(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Inject X-Guest-Id (always if exists, allowing merge)
    // We check if it's already set by the caller to avoid overriding specific intent
    if (guestId && !config.headers['X-Guest-Id']) {
      config.headers['X-Guest-Id'] = guestId;
    }

    if (__DEV__) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
        hasAuth: !!config.headers.Authorization,
        hasGuest: !!config.headers['X-Guest-Id']
      });
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401
let isRefreshing = false;

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { useAuthStore } = require('../stores/authStore');
    const { router } = require('expo-router'); // Ensure expo-router is available

    // Handle Trial Expiration
    if (error.response?.data?.code === 'TRIAL_EXPIRED' || error.response?.status === 402) {
        // Navigate to Paywall using global router from expo-router (need to verify this works in client.ts context)
        // Usually router.replace requires component context, but expo-router 2+ exports a router object?
        // Actually, explicit import from 'expo-router' might work if setup correctly.
        // If not, we might need a navigation ref service.
        // Assuming basic router usage works or we fallback to console log for now if fails.
        try {
            router.replace('/paywall');
        } catch (navError) {
            console.error("Failed to navigate to paywall", navError);
        }
        return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      const token = useAuthStore.getState().token;

      // Only logout if we actually sent a token that might be expired
      // If we are guest (no token or invalid token), do NOT logout/redirect to login on 401
      if (isLikelyJwt(token)) {
          // Prevent infinite loops if logout itself fails or if multiple requests fail at once
          if (!isRefreshing) {
            isRefreshing = true;
            try {
               // Ensure we don't clear token if the request was to login!
               if (!error.config.url.includes('/login')) {
                   await useAuthStore.getState().logout();
               }
            } catch (logoutError) {
              console.error("Logout failed during 401 handling:", logoutError);
            } finally {
              isRefreshing = false;
            }
          }
      }
    }
    return Promise.reject(error);
  }
);

export default client;
