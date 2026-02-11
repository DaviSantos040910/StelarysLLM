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

// Request Interceptor: Inject Token
client.interceptors.request.use(
  (config) => {
    // Dynamic require to avoid circular dependency
    const { useAuthStore } = require('../stores/authStore');
    const { token, guestId } = useAuthStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (guestId) {
      config.headers['X-Guest-Id'] = guestId;
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

    if (error.response?.status === 401) {
      // Prevent infinite loops if logout itself fails or if multiple requests fail at once
      if (!isRefreshing) {
        isRefreshing = true;
        try {
           // Ensure we don't clear token if the request was to login!
           // But normally 401 on other endpoints means token expired/invalid.
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
    return Promise.reject(error);
  }
);

export default client;
