import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const INSTALLATION_ID_KEY = 'installation_id';

let memoryCacheId: string | null = null;

export const getInstallationId = async (): Promise<string> => {
  if (memoryCacheId) return memoryCacheId;

  try {
    let id: string | null = null;

    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        id = localStorage.getItem(INSTALLATION_ID_KEY);
      }
    } else {
      id = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
    }

    if (!id) {
      id = Crypto.randomUUID();
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(INSTALLATION_ID_KEY, id);
        }
      } else {
        await SecureStore.setItemAsync(INSTALLATION_ID_KEY, id);
      }
    }

    memoryCacheId = id;
    return id;
  } catch (error) {
    console.warn('Failed to manage installation ID', error);
    // Fallback if storage fails completely
    if (!memoryCacheId) memoryCacheId = Crypto.randomUUID();
    return memoryCacheId;
  }
};
