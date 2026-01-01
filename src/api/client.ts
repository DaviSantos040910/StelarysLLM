import axios from 'axios';

const DEV_URL = 'http://192.168.1.88:8000';
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
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
          await useAuthStore.getState().logout();
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
