import { Platform } from 'react-native';

export const IAP_SKUS = {
  BASIC_MONTHLY: 'stelarys_basic_monthly',
};

export const PLATFORM_SKUS = Platform.select({
  android: [IAP_SKUS.BASIC_MONTHLY],
  ios: [IAP_SKUS.BASIC_MONTHLY],
  default: [IAP_SKUS.BASIC_MONTHLY],
});
