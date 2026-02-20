import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PaywallModal } from '../src/components/billing/PaywallModal';
import { useBillingStore } from '../src/stores/billingStore';

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { fetchStatus } = useBillingStore();

  useEffect(() => {
    // Refresh limits when paywall is shown to ensure latest state
    fetchStatus();
  }, []);

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const title = typeof params.title === 'string' ? params.title : "Limite atingido";
  const message = typeof params.message === 'string' ? params.message : undefined;

  return (
    <View className="flex-1 bg-black">
      <PaywallModal
        visible={true}
        onClose={handleClose}
        title={title}
        message={message}
      />
    </View>
  );
}
