import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const DEV_URL = 'http://127.0.0.1:8000'; // Or your machine's local IP like 192.168.1.X for physical device
const PROD_URL = 'https://api.stelarys.com'; // Placeholder

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
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default client;
