// src/services/iap/nativeIap.ts

export async function loadIap() {
  try {
    // Dynamic import to avoid top-level execution of NitroModules
    const RNIap = await import('react-native-iap');
    return {
      available: true,
      module: RNIap
    };
  } catch (error) {
    console.warn('[IAP] Native module missing or failed to load. This is expected in Expo Go.', error);
    return {
      available: false,
      reason: 'native_module_missing',
      module: null
    };
  }
}
