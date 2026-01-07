import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Table } from 'lucide-react-native';

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
    <View className="flex-1 bg-white p-4 pt-16">
        <View className="flex-row items-center mb-4">
            <View className="bg-emerald-500 p-2 rounded-lg mr-3">
                <Table color="white" size={24} />
            </View>
            <View>
                <Text className="text-gray-800 text-xl font-bold">Visualizador de Tabela</Text>
                <Text className="text-gray-500 text-xs">Modo de Leitura</Text>
            </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
                {/* Header Row (Letters) */}
                <View className="flex-row border-b border-gray-300 bg-gray-100">
                    <View className="w-10 border-r border-gray-300 p-2 items-center justify-center bg-gray-200">
                        <Text className="font-bold text-gray-500">#</Text>
                    </View>
                    {headers.map((h, i) => (
                        <View key={i} className="w-32 border-r border-gray-300 p-2 items-center justify-center">
                            <Text className="font-bold text-gray-600">{h}</Text>
                        </View>
                    ))}
                </View>

                {/* Data Rows */}
                <ScrollView showsVerticalScrollIndicator={false}>
                    {rows.map((row, rowIndex) => (
                        <View key={rowIndex} className="flex-row border-b border-gray-200">
                            {/* Row Number */}
                            <View className="w-10 border-r border-gray-300 p-2 items-center justify-center bg-gray-50">
                                <Text className="text-gray-400 font-mono">{rowIndex + 1}</Text>
                            </View>
                            {/* Cells */}
                            {row.map((cell, cellIndex) => (
                                <View key={cellIndex} className="w-32 border-r border-gray-200 p-2 justify-center">
                                    <Text className="text-gray-800" numberOfLines={1}>{cell}</Text>
                                </View>
                            ))}
                        </View>
                    ))}
                    {/* Empty filler rows */}
                    {Array.from({ length: 10 }).map((_, i) => (
                        <View key={`empty-${i}`} className="flex-row border-b border-gray-100">
                            <View className="w-10 border-r border-gray-300 p-2 bg-gray-50" />
                            {headers.map((_, j) => (
                                <View key={j} className="w-32 border-r border-gray-100 p-2" />
                            ))}
                        </View>
                    ))}
                </ScrollView>
            </View>
        </ScrollView>
    </View>
  );
};
