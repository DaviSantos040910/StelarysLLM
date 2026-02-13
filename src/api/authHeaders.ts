import { useAuthStore } from '../stores/authStore';

const isLikelyJwt = (token: string | null) => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(p => p.length > 0);
};

export function getAuthHeaders(extra: Record<string, string> = {}) {
  const { token, guestId } = useAuthStore.getState();

  const headers: Record<string, string> = { ...extra };

  if (token && isLikelyJwt(token)) {
    headers.Authorization = `Bearer ${token}`;
  } else if (guestId) {
    headers['X-Guest-Id'] = guestId;
  }

  return headers;
}
