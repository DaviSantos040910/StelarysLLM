import React from 'react';
import { View, Text, Modal, Pressable, Platform } from 'react-native';
import { X, Check, Lock } from 'lucide-react-native';
import { themeClasses } from '../../theme/classes';
import { useRouter } from 'expo-router';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  title = "Assine para continuar"
}) => {
  const router = useRouter();

  const handleSubscribe = () => {
    // TODO: Implement actual purchase flow
    console.log('[Paywall] Subscribe clicked');
  };

  const handleSeePlans = () => {
    onClose();
    router.push('/plans');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/80">
        <View className={`rounded-t-3xl p-6 pb-10 ${themeClasses.surface} border-t border-gray-200 dark:border-white/10`}>

          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <View className="w-10" />
            <View className="w-16 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full" />
            <Pressable onPress={onClose} className="p-2">
              <X size={24} color="#94a3b8" />
            </Pressable>
          </View>

          {/* Icon & Title */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-cosmic-purple/20 rounded-full items-center justify-center mb-4">
              <Lock size={32} color="#818cf8" />
            </View>
            <Text className={`${themeClasses.textPrimary} text-2xl font-bold text-center mb-2`}>
              {title}
            </Text>
            <Text className={`${themeClasses.textSecondary} text-center px-4`}>
              Desbloqueie todo o potencial do Stelarys com o plano Basic.
            </Text>
          </View>

          {/* Benefits */}
          <View className="mb-8 space-y-3">
            {[
              "Mensagens ilimitadas com IA",
              "Upload de até 50 arquivos (PDF, Docs)",
              "Geração de Quizzes, Resumos e Podcasts",
              "Vozes neurais para leitura (TTS)"
            ].map((benefit, idx) => (
              <View key={idx} className="flex-row items-center bg-gray-50 dark:bg-white/5 p-3 rounded-xl">
                <View className="bg-green-500/20 p-1 rounded-full mr-3">
                  <Check size={14} color="#4ade80" />
                </View>
                <Text className={`${themeClasses.textPrimary} font-medium flex-1`}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <View className="gap-3">
            <Pressable
              onPress={handleSubscribe}
              className="bg-cosmic-purple py-4 rounded-xl items-center shadow-lg shadow-indigo-500/30 active:opacity-90"
            >
              <Text className="text-white font-bold text-lg">
                Assinar por R$ 29,90/mês
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSeePlans}
              className="py-3 items-center"
            >
              <Text className={`${themeClasses.textMuted} font-medium`}>
                Ver todos os planos
              </Text>
            </Pressable>
          </View>

        </View>
      </View>
    </Modal>
  );
};
