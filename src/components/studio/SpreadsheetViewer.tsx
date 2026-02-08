import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Table } from 'lucide-react-native';
import { themeClasses } from '../../theme/classes';

export const SpreadsheetViewer = () => {
  // Mock Data for visualization
  const headers = ['A', 'B', 'C', 'D', 'E'];
  const rows = [
    ['Fórmula', 'Descrição', 'Uso', 'Exemplo', 'Obs'],
    ['SOMA', 'Soma valores', 'Matemática', '=SOMA(A1:A10)', '-'],
    ['MÉDIA', 'Calcula média', 'Estatística', '=MÉDIA(B1:B5)', '-'],
    ['SE', 'Condicional', 'Lógica', '=SE(C1>10; "Ok"; "No")', '-'],
    ['PROCV', 'Busca vertical', 'Busca', '=PROCV(D1; A:B; 2; 0)', 'Essencial'],
    ['CONCAT', 'Une textos', 'Texto', '=CONCAT("Ola"; "Mundo")', '-'],
    ['HOJE', 'Data atual', 'Data', '=HOJE()', 'Volátil'],
  ];

  return (
    <View className={`flex-1 p-4 pt-16 ${themeClasses.screen}`}>
        <View className="flex-row items-center mb-4">
            <View className="bg-emerald-500 p-2 rounded-lg mr-3">
                <Table color="white" size={24} />
            </View>
            <View>
                <Text className={`${themeClasses.textPrimary} text-xl font-bold`}>Visualizador de Tabela</Text>
                <Text className={`${themeClasses.textSecondary} text-xs`}>Modo de Leitura</Text>
            </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true} className={`border border-gray-200 dark:border-white/10 rounded-lg ${themeClasses.surface}`}>
            <View>
                {/* Header Row (Letters) */}
                <View className="flex-row border-b border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-white/5">
                    <View className="w-10 border-r border-gray-300 dark:border-white/10 p-2 items-center justify-center bg-gray-200 dark:bg-white/10">
                        <Text className={`${themeClasses.textMuted} font-bold`}>#</Text>
                    </View>
                    {headers.map((h, i) => (
                        <View key={i} className="w-32 border-r border-gray-300 dark:border-white/10 p-2 items-center justify-center">
                            <Text className={`${themeClasses.textSecondary} font-bold`}>{h}</Text>
                        </View>
                    ))}
                </View>

                {/* Data Rows */}
                <ScrollView showsVerticalScrollIndicator={false}>
                    {rows.map((row, rowIndex) => (
                        <View key={rowIndex} className="flex-row border-b border-gray-200 dark:border-white/5">
                            {/* Row Number */}
                            <View className="w-10 border-r border-gray-300 dark:border-white/10 p-2 items-center justify-center bg-gray-50 dark:bg-white/5">
                                <Text className={`${themeClasses.textMuted} font-mono`}>{rowIndex + 1}</Text>
                            </View>
                            {/* Cells */}
                            {row.map((cell, cellIndex) => (
                                <View key={cellIndex} className="w-32 border-r border-gray-200 dark:border-white/5 p-2 justify-center">
                                    <Text className={themeClasses.textPrimary} numberOfLines={1}>{cell}</Text>
                                </View>
                            ))}
                        </View>
                    ))}
                    {/* Empty filler rows */}
                    {Array.from({ length: 10 }).map((_, i) => (
                        <View key={`empty-${i}`} className="flex-row border-b border-gray-100 dark:border-white/5">
                            <View className="w-10 border-r border-gray-300 dark:border-white/10 p-2 bg-gray-50 dark:bg-white/5" />
                            {headers.map((_, j) => (
                                <View key={j} className="w-32 border-r border-gray-100 dark:border-white/5 p-2" />
                            ))}
                        </View>
                    ))}
                </ScrollView>
            </View>
        </ScrollView>
    </View>
  );
};
