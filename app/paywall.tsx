import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PaywallModal } from '../src/components/billing/PaywallModal';

export default function PaywallScreen() {
  const router = useRouter();

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View className="flex-1 bg-black">
      <PaywallModal
        visible={true}
        onClose={handleClose}
        title="Limite atingido"
      />
    </View>
  );
}
