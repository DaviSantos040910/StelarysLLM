import Constants, { ExecutionEnvironment } from 'expo-constants';

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export async function loadIap() {
  // Check if running in Expo Go
  if (isExpoGo) {
    console.log('[IAP] Running in Expo Go (StoreClient). IAP disabled to prevent crashes.');
    return {
        available: false,
        reason: 'expo_go',
        module: null
    };
  }

  try {
    // Dynamic import to avoid top-level execution of NitroModules in environments where they might be missing
    const RNIap = await import('react-native-iap');
    return {
      available: true,
      module: RNIap
    };
  } catch (error) {
    console.warn('[IAP] Native module missing or failed to load.', error);
    return {
      available: false,
      reason: 'native_module_missing',
      module: null
    };
  }
}
