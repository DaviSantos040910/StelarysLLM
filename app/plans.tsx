import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useBillingStore } from '../src/stores/billingStore';
import { themeClasses } from '../src/theme/classes';
import { useRouter } from 'expo-router';
import { X, Check, Zap, Clock, FileText, MessageSquare, Mic, Crown, AlertTriangle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const UsageBar = ({ label, used, limit, icon: Icon, unit = '' }: any) => {
  const percentage = Math.min(100, Math.max(0, (used / limit) * 100));
  const isFull = used >= limit;

  return (
    <View className="mb-4">
      <View className="flex-row justify-between items-center mb-1">
        <View className="flex-row items-center">
          {Icon && <Icon size={14} color="#94a3b8" className="mr-2" />}
          <Text className={`${themeClasses.textSecondary} text-sm font-medium`}>{label}</Text>
        </View>
        <Text className={`${themeClasses.textMuted} text-xs`}>
          {used} / {limit} {unit}
        </Text>
      </View>
      <View className="h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-cosmic-purple'}`}
          style={{ width: `${percentage}%` }}
        />
      </View>
    </View>
  );
};

export default function PlansScreen() {
  const router = useRouter();
  const { status, fetchStatus, isLoading } = useBillingStore();

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSubscribe = () => {
    // TODO: Connect to RevenueCat/IAP
    Alert.alert("Assinatura", "Fluxo de pagamento via Google Play (Em breve)");
  };

  if (isLoading && !status) {
    return (
      <View className={`flex-1 justify-center items-center ${themeClasses.screen}`}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  const isTrial = status?.plan === 'TRIAL';
  const isBasic = status?.plan === 'BASIC';
  const isLocked = status?.plan === 'LOCKED';

  return (
    <View className={`flex-1 ${themeClasses.screen}`}>
      <SafeAreaView edges={['top']} className="flex-1">

        {/* Header */}
        <View className="px-6 py-4 flex-row justify-between items-center border-b border-gray-200 dark:border-white/5">
          <Text className={`${themeClasses.textPrimary} text-xl font-bold`}>Meu Plano</Text>
          <Pressable onPress={() => router.back()} className={`p-2 rounded-full ${themeClasses.softSurface}`}>
            <X size={24} color="#94a3b8" />
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>

          {/* Current Status Card */}
          <View className={`p-5 rounded-2xl mb-8 border ${isLocked ? 'bg-red-500/10 border-red-500/30' : (isBasic ? 'bg-cosmic-purple/10 border-cosmic-purple/30' : 'bg-gray-100 dark:bg-white/5 border-transparent')}`}>
            <View className="flex-row items-center mb-4">
              {isBasic ? <Crown size={24} color="#818cf8" /> : (isLocked ? <AlertTriangle size={24} color="#ef4444" /> : <Clock size={24} color="#fbbf24" />)}
              <Text className={`text-lg font-bold ml-3 ${isLocked ? 'text-red-500' : themeClasses.textPrimary}`}>
                {isBasic ? 'Plano Basic' : (isTrial ? 'Período de Teste' : 'Plano Expirado')}
              </Text>
            </View>

            {isTrial && (
              <Text className={`${themeClasses.textSecondary} mb-4`}>
                Você tem <Text className="font-bold text-amber-400">{status?.trial_days_left ?? 0} dias</Text> restantes de teste gratuito.
              </Text>
            )}

            {isLocked && (
              <Text className={`${themeClasses.textSecondary} mb-4 text-red-400`}>
                Seu período de teste acabou. Assine para continuar usando o Stelarys.
              </Text>
            )}

            {/* Usage Stats */}
            {status && (
              <View className="mt-2">
                <UsageBar
                  label="Mensagens"
                  used={status.usage.messages_count}
                  limit={status.limits.messages_monthly || 90}
                  icon={MessageSquare}
                />
                <UsageBar
                  label="Fontes (Docs)"
                  used={status.usage.sources_count}
                  limit={status.limits.sources_total || 50}
                  icon={FileText}
                />
                <UsageBar
                  label="Artefatos (Resumos/Quiz)"
                  used={status.usage.artifacts_count}
                  limit={status.limits.artifacts_monthly || 50}
                  icon={Zap}
                />
                <UsageBar
                  label="TTS (Áudio)"
                  used={status.usage.tts_seconds_count}
                  limit={status.limits.tts_seconds_monthly || 0}
                  unit="s"
                  icon={Mic}
                />
              </View>
            )}
          </View>

          {/* Basic Plan Offer */}
          {!isBasic && (
            <View className={`p-6 rounded-3xl mb-10 border border-cosmic-purple/50 bg-gradient-to-br from-indigo-900/40 to-purple-900/40`}>
              <View className="flex-row justify-between items-start mb-2">
                <View>
                  <Text className="text-white text-2xl font-bold">Basic</Text>
                  <Text className="text-indigo-200">Para estudantes dedicados</Text>
                </View>
                <View className="bg-cosmic-purple px-3 py-1 rounded-full">
                  <Text className="text-white text-xs font-bold">POPULAR</Text>
                </View>
              </View>

              <View className="flex-row items-end mb-6">
                <Text className="text-white text-3xl font-bold">R$ 29,90</Text>
                <Text className="text-indigo-200 mb-1 ml-1">/mês</Text>
              </View>

              <View className="space-y-3 mb-8">
                {[
                  "2.000 mensagens com IA por mês",
                  "Até 50 arquivos na biblioteca",
                  "Geração de Podcasts e Resumos",
                  "Vozes neurais ilimitadas (3h/mês)"
                ].map((feat, i) => (
                  <View key={i} className="flex-row items-center">
                    <View className="bg-green-500/20 p-1 rounded-full mr-3">
                      <Check size={12} color="#4ade80" />
                    </View>
                    <Text className="text-gray-100 flex-1">{feat}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={handleSubscribe}
                className="bg-white py-4 rounded-xl items-center active:bg-gray-100"
              >
                <Text className="text-indigo-900 font-bold text-lg">
                  Assinar com Google Play
                </Text>
              </Pressable>
            </View>
          )}

          <View className="h-10" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
