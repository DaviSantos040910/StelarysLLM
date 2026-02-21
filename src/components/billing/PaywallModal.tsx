import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { X, Check, Lock, MessageSquare, Zap, Mic, FileText } from 'lucide-react-native';
import { themeClasses } from '../../theme/classes';
import { useRouter } from 'expo-router';
import { iapService } from '../../services/iapService';
import { useBillingStore } from '../../stores/billingStore';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

const UsageProgress = ({ label, used, limit, icon: Icon }: any) => {
  const percentage = Math.min(100, Math.max(0, (used / limit) * 100));
  const isFull = used >= limit;

  if (!limit) return null; // Don't show if unlimited or unknown

  return (
    <View className="mb-3">
      <View className="flex-row justify-between items-center mb-1">
        <View className="flex-row items-center">
          {Icon && <Icon size={12} color={isFull ? "#ef4444" : "#94a3b8"} className="mr-2" />}
          <Text className={`${isFull ? "text-red-500 font-bold" : themeClasses.textSecondary} text-xs`}>{label}</Text>
        </View>
        <Text className={`${themeClasses.textMuted} text-xs`}>
          {used}/{limit}
        </Text>
      </View>
      <View className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-cosmic-purple'}`}
          style={{ width: `${percentage}%` }}
        />
      </View>
    </View>
  );
};

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  title = "Assine para continuar",
  message
}) => {
  const router = useRouter();
  const { status } = useBillingStore();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      iapService.initialize().then(() => {
         setUnavailableReason(iapService.unavailableReason);
      });
    }
  }, [visible]);

  const handleSubscribe = async () => {
    try {
      setIsPurchasing(true);
      await iapService.purchaseBasicPlan();
      // On success, iapService updates the store automatically via listener
      // We can close the modal here if we detect status change, or let the user close it manually
      // or implement a listener to store changes.
      // For now, simpler UX: just wait. If successful, user likely sees a confirmation or just closes it.
      // Ideally, we wait for status change to BASIC.
    } catch (error: any) {
      if (error.message !== 'E_USER_CANCELLED') {
        Alert.alert("Erro", "Não foi possível iniciar a assinatura. Tente novamente.");
      }
    } finally {
      setIsPurchasing(false);
    }
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
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-cosmic-purple/20 rounded-full items-center justify-center mb-4">
              <Lock size={32} color="#818cf8" />
            </View>
            <Text className={`${themeClasses.textPrimary} text-2xl font-bold text-center mb-2`}>
              {title}
            </Text>
            {message && (
                <Text className="text-red-500 font-medium text-center px-4 mb-2">
                    {message}
                </Text>
            )}
            <Text className={`${themeClasses.textSecondary} text-center px-4 text-sm`}>
              Faça o upgrade para o plano Basic e continue aprendendo sem limites.
            </Text>
          </View>

          {/* Usage Stats (Dynamic) */}
          {status && (
            <View className="mb-6 bg-gray-50 dark:bg-white/5 p-4 rounded-xl">
               <Text className={`${themeClasses.textPrimary} font-bold mb-3 text-sm`}>Seu uso atual:</Text>

               <UsageProgress
                  label="Mensagens"
                  used={status.usage.messages_count}
                  limit={status.limits.messages_monthly || 90}
                  icon={MessageSquare}
                />
               <UsageProgress
                  label="Artefatos"
                  used={status.usage.artifacts_count}
                  limit={status.limits.artifacts_monthly}
                  icon={Zap}
                />
               <UsageProgress
                  label="Fontes"
                  used={status.usage.sources_count}
                  limit={status.limits.sources_total}
                  icon={FileText}
                />
            </View>
          )}

          {/* Actions */}
          <View className="gap-3">
            <Pressable
              onPress={handleSubscribe}
              disabled={isPurchasing || !!unavailableReason}
              className={`bg-cosmic-purple py-4 rounded-xl items-center shadow-lg shadow-indigo-500/30 active:opacity-90 flex-row justify-center ${unavailableReason ? 'opacity-50' : ''}`}
            >
              {isPurchasing && <ActivityIndicator color="white" className="mr-2" />}
              <Text className="text-white font-bold text-lg">
                {unavailableReason === 'expo_go'
                   ? 'Disponível apenas no Dev Build'
                   : (isPurchasing ? 'Processando...' : 'Assinar por R$ 29,90/mês')}
              </Text>
            </Pressable>

            {unavailableReason === 'expo_go' && (
                <Text className="text-red-400 text-center text-xs px-4">
                    Pagamentos disponíveis apenas no Dev Build/Play Store (NitroModules não suportados no Expo Go).
                </Text>
            )}

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
