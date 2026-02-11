import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { themeClasses } from '../src/theme/classes';
import { Crown, Check } from 'lucide-react-native';

export default function PaywallScreen() {
  const router = useRouter();

  const handleSubscribe = () => {
    // Implement subscription flow here
    console.log('Subscribe clicked');
  };

  return (
    <SafeAreaView className={`flex-1 ${themeClasses.screen}`}>
      <View className="flex-1 px-6 py-8 justify-between">

        <ScrollView contentContainerStyle={{ alignItems: 'center' }}>
          <View className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900 justify-center items-center mb-6">
            <Crown size={40} className="text-amber-500 dark:text-amber-400" />
          </View>

          <Text className={`text-3xl font-bold text-center mb-2 ${themeClasses.textPrimary}`}>
            Trial Expirado
          </Text>

          <Text className={`text-lg text-center mb-8 ${themeClasses.textSecondary}`}>
            Seu período de teste gratuito acabou. Assine o Stelarys Premium para continuar aprendendo sem limites.
          </Text>

          <View className={`w-full p-6 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 mb-6`}>
            <Text className={`text-xl font-bold mb-4 text-indigo-900 dark:text-indigo-100`}>
              Stelarys Premium
            </Text>

            <View className="space-y-3">
              {[
                'Tutores Ilimitados',
                'Arquivos e Fontes Ilimitados',
                'Geração de Quizzes e Resumos',
                'Suporte Prioritário'
              ].map((feature, i) => (
                <View key={i} className="flex-row items-center gap-3">
                  <View className="bg-indigo-500 rounded-full p-1">
                    <Check size={12} color="white" />
                  </View>
                  <Text className={themeClasses.textSecondary}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View className="space-y-4">
          <TouchableOpacity
            onPress={handleSubscribe}
            className="bg-indigo-600 py-4 rounded-full justify-center items-center shadow-lg shadow-indigo-500/30"
          >
            <Text className="text-white font-bold text-lg">Assinar Agora</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            className={`py-4 rounded-full border border-gray-300 dark:border-gray-700 justify-center items-center`}
          >
            <Text className={`font-semibold ${themeClasses.textPrimary}`}>
              Já tenho uma conta
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/signup')}
            className="py-2 items-center"
          >
             <Text className="text-indigo-500 font-medium">Criar nova conta</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}
