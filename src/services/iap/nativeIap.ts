import Constants, { ExecutionEnvironment } from 'expo-constants';

export async function loadIap() {
  // Check if running in Expo Go
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  if (isExpoGo) {
    console.log('[IAP] Running in Expo Go. IAP disabled.');
    return {
        available: false,
        reason: 'expo_go',
        module: null
    };
  }

  try {
    // Dynamic import to avoid top-level execution of NitroModules
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
