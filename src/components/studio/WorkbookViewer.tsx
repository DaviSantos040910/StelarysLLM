import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Book } from 'lucide-react-native';
import { themeClasses } from '../../theme/classes';

export const WorkbookViewer = () => {
  return (
    <View className={`flex-1 items-center pt-16 pb-8 ${themeClasses.screen}`}>
        <ScrollView
            className={`w-[90%] flex-1 shadow-lg rounded-sm ${themeClasses.surface}`}
            contentContainerStyle={{ padding: 40 }}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View className={`items-center mb-10 border-b-2 border-gray-100 dark:border-white/10 pb-8`}>
                <Book color="#60a5fa" size={48} />
                <Text className={`text-3xl font-bold mt-4 text-center ${themeClasses.textPrimary}`}>Apostila de Estudo</Text>
                <Text className={`${themeClasses.textMuted} mt-2 uppercase tracking-widest font-medium`}>Módulo 1: Fundamentos</Text>
            </View>

            {/* Chapter 1 */}
            <View className="mb-10">
                <Text className={`text-xl font-bold mb-4 ${themeClasses.textPrimary}`}>1. Introdução</Text>
                <Text className={`${themeClasses.textSecondary} leading-7 text-justify mb-4`}>
                    Este material foi gerado automaticamente pela IA para auxiliar no seu aprendizado.
                    O conteúdo abrange os conceitos fundamentais discutidos em aula, organizados de forma lógica e progressiva.
                </Text>
                <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-400 mb-4">
                    <Text className="text-blue-800 dark:text-blue-200 italic">
                        "O aprendizado é um processo contínuo de descoberta e revisão."
                    </Text>
                </View>
            </View>

            {/* Chapter 2 */}
            <View className="mb-10">
                <Text className={`text-xl font-bold mb-4 ${themeClasses.textPrimary}`}>2. Conceitos Chave</Text>
                <Text className={`${themeClasses.textSecondary} leading-7 text-justify mb-4`}>
                    Neste capítulo, exploraremos as definições primárias. É crucial entender a terminologia antes de avançar para aplicações práticas.
                </Text>

                {/* List Mock */}
                <View className="ml-4 space-y-2">
                    <Text className={themeClasses.textSecondary}>• Definição de Variáveis</Text>
                    <Text className={themeClasses.textSecondary}>• Escopo e Contexto</Text>
                    <Text className={themeClasses.textSecondary}>• Funções e Métodos</Text>
                </View>
            </View>

            {/* Chapter 3 */}
            <View className="mb-10">
                <Text className={`text-xl font-bold mb-4 ${themeClasses.textPrimary}`}>3. Aplicação Prática</Text>
                <Text className={`${themeClasses.textSecondary} leading-7 text-justify mb-4`}>
                    Agora vamos aplicar o que aprendemos. Observe os exemplos abaixo e tente replicá-los em seu próprio ambiente de estudo.
                </Text>
                <View className={`h-40 rounded-lg items-center justify-center ${themeClasses.softSurface}`}>
                    <Text className={`${themeClasses.textMuted} font-bold`}>[Diagrama Explicativo]</Text>
                </View>
            </View>

            {/* Footer */}
            <View className="items-center mt-10 pt-10 border-t border-gray-100 dark:border-white/10">
                <Text className={`${themeClasses.textMuted} text-xs`}>Gerado por Stelarys AI • Página 1 de 12</Text>
            </View>
        </ScrollView>
    </View>
  );
};
