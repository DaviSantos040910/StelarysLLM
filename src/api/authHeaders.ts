import { useAuthStore } from '../stores/authStore';
import { getInstallationId } from '../utils/installationId';
import { isLikelyJwt } from './client';

export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { token, guestId } = useAuthStore.getState();
  const installationId = await getInstallationId();

  const headers: Record<string, string> = {
    'X-Installation-Id': installationId,
  };

  if (isLikelyJwt(token)) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (guestId) {
    headers['X-Guest-Id'] = guestId;
  }

  return headers;
};
