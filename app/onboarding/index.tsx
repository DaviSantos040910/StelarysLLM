import { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/stores/appStore';
import { themeClasses } from '../../src/theme/classes';
import { ArrowRight, Check, BookOpen, GraduationCap, Zap } from 'lucide-react-native';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setHasSeenOnboarding } = useAppStore();
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleFinish = async () => {
    await setHasSeenOnboarding(true);
    // Proceed as Guest
    router.replace('/(tabs)');
  };

  const handleLogin = async () => {
    await setHasSeenOnboarding(true);
    router.push('/(auth)/login');
  };

  const templates = [
    { id: '1', name: 'Tutor Socrático', icon: GraduationCap, desc: 'Aprenda fazendo perguntas.' },
    { id: '2', name: 'Resumidor Rápido', icon: Zap, desc: 'Resumos diretos ao ponto.' },
    { id: '3', name: 'Explorador de Arquivos', icon: BookOpen, desc: 'Analise seus PDFs profundamente.' },
  ];

  return (
    <SafeAreaView className={`flex-1 ${themeClasses.screen}`}>
      <View className="flex-1 px-6 py-8 justify-between">

        {/* Content */}
        <View className="flex-1">
          {/* Header Progress */}
          <View className="flex-row gap-2 mb-8">
            {[1, 2, 3].map(i => (
              <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-800'}`} />
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {step === 1 && (
              <View className="space-y-6">
                <Text className={`text-3xl font-bold ${themeClasses.textPrimary}`}>
                  Bem-vindo ao Stelarys
                </Text>
                <Text className={`text-lg ${themeClasses.textSecondary}`}>
                  Sua plataforma de aprendizado assistida por Inteligência Artificial.
                </Text>
                <View className="space-y-4 mt-4">
                  <View className="flex-row items-center gap-4">
                    <View className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 justify-center items-center">
                      <GraduationCap size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </View>
                    <Text className={`flex-1 ${themeClasses.textSecondary}`}>Crie Tutores Personalizados</Text>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <View className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 justify-center items-center">
                      <BookOpen size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </View>
                    <Text className={`flex-1 ${themeClasses.textSecondary}`}>Estude com seus próprios arquivos (RAG)</Text>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <View className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 justify-center items-center">
                      <Zap size={20} className="text-amber-600 dark:text-amber-400" />
                    </View>
                    <Text className={`flex-1 ${themeClasses.textSecondary}`}>Gere Quizzes e Flashcards automaticamente</Text>
                  </View>
                </View>
              </View>
            )}

            {step === 2 && (
              <View className="space-y-6">
                <Text className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
                  Escolha seu primeiro Tutor
                </Text>
                <Text className={`${themeClasses.textSecondary}`}>
                  Comece com um template pronto. Você pode personalizar depois.
                </Text>
                <View className="space-y-3 mt-2">
                  {templates.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setSelectedTemplate(t.id)}
                      className={`p-4 rounded-xl border ${selectedTemplate === t.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'}`}
                    >
                      <View className="flex-row items-center gap-3">
                        <t.icon size={24} className={selectedTemplate === t.id ? 'text-indigo-500' : 'text-gray-500'} />
                        <View className="flex-1">
                          <Text className={`font-semibold ${themeClasses.textPrimary}`}>{t.name}</Text>
                          <Text className={`text-sm ${themeClasses.textMuted}`}>{t.desc}</Text>
                        </View>
                        {selectedTemplate === t.id && <Check size={20} className="text-indigo-500" />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {step === 3 && (
              <View className="space-y-6">
                <Text className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
                  Adicione conhecimento
                </Text>
                <Text className={`${themeClasses.textSecondary}`}>
                  Opcional: Envie um PDF ou link para seu tutor estudar agora.
                </Text>

                <View className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl h-40 justify-center items-center bg-gray-50 dark:bg-gray-900/50">
                  <Text className={`text-center ${themeClasses.textMuted}`}>
                    (Simulação de Upload)
                  </Text>
                  <Text className={`text-center mt-2 ${themeClasses.textSecondary} opacity-60`}>
                    Toque para selecionar um arquivo
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Footer Actions */}
        <View className="pt-6">
          {step < 3 ? (
            <TouchableOpacity
              onPress={() => setStep(step + 1)}
              className="bg-indigo-600 py-4 rounded-full flex-row justify-center items-center shadow-lg shadow-indigo-500/30"
            >
              <Text className="text-white font-bold text-lg mr-2">Próximo</Text>
              <ArrowRight size={20} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleFinish}
              className="bg-indigo-600 py-4 rounded-full justify-center items-center shadow-lg shadow-indigo-500/30"
            >
              <Text className="text-white font-bold text-lg">Começar Agora (Guest)</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleLogin} className="mt-4 py-3 items-center">
            <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">
              Já tenho conta
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
