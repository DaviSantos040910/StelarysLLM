import React, { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Headphones,
  BookOpen,
  FileQuestion,
  FileText,
  Lightbulb,
  CheckCircle2,
  Play
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// Mock Data
const MOCK_ARTIFACTS = [
    { id: '1', type: 'audio', title: 'Resumo da Aula 1', date: 'Há 2 horas', duration: '5:20', color: '#818cf8' },
    { id: '2', type: 'text', title: 'Notas sobre Derivadas', date: 'Ontem', lines: 12, color: '#c084fc' },
    { id: '3', type: 'quiz', title: 'Teste Rápido: Limites', date: '3 dias atrás', score: '8/10', color: '#2dd4bf' },
    { id: '4', type: 'guide', title: 'Guia de Estudo: Cálculo I', date: 'Semana passada', items: 25, color: '#f472b6' },
    { id: '5', type: 'audio', title: 'Podcast: História do Pi', date: 'Semana passada', duration: '12:05', color: '#818cf8' },
    { id: '6', type: 'slides', title: 'Apresentação Final', date: '2 semanas atrás', slides: 8, color: '#fbbf24' },
];

const FILTER_TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'audio', label: 'Áudio' },
  { id: 'text', label: 'Texto' },
  { id: 'quiz', label: 'Quiz' },
];

export default function StudioGalleryScreen() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams();
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredData = activeFilter === 'all'
    ? MOCK_ARTIFACTS
    : MOCK_ARTIFACTS.filter(item => {
        if (activeFilter === 'audio') return item.type === 'audio';
        if (activeFilter === 'text') return item.type === 'text' || item.type === 'guide' || item.type === 'slides';
        if (activeFilter === 'quiz') return item.type === 'quiz';
        return true;
    });

  const getIcon = (type: string, color: string) => {
      switch(type) {
          case 'audio': return <Headphones color={color} size={24} />;
          case 'quiz': return <FileQuestion color={color} size={24} />;
          case 'guide': return <BookOpen color={color} size={24} />;
          case 'slides': return <Lightbulb color={color} size={24} />;
          default: return <FileText color={color} size={24} />;
      }
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50)}
      className="flex-1 m-2 p-4 bg-space-light rounded-2xl border border-white/10 min-h-[140px] justify-between"
    >
        <View className="flex-row justify-between items-start">
            <View className="p-2 bg-white/5 rounded-full">
                {getIcon(item.type, item.color)}
            </View>
            {item.type === 'audio' && (
                <Pressable className="p-1.5 bg-cosmic-purple/20 rounded-full">
                    <Play size={12} color="#818cf8" fill="#818cf8" />
                </Pressable>
            )}
             {item.type === 'quiz' && item.score && (
                <View className="px-2 py-1 bg-teal-500/20 rounded-lg">
                    <Text className="text-teal-400 text-xs font-bold">{item.score}</Text>
                </View>
            )}
        </View>

        <View>
            <Text className="text-starlight font-bold text-base leading-tight mb-1" numberOfLines={2}>
                {item.title}
            </Text>
            <Text className="text-gray-500 text-xs">{item.date}</Text>
        </View>

        {/* Footer info based on type */}
        <View className="mt-2 pt-2 border-t border-white/5">
             {item.type === 'audio' && <Text className="text-gray-400 text-xs font-medium">{item.duration} min</Text>}
             {item.type === 'quiz' && <Text className="text-gray-400 text-xs font-medium">Revisar</Text>}
             {item.type === 'guide' && <Text className="text-gray-400 text-xs font-medium">{item.items} tópicos</Text>}
             {(item.type === 'text' || item.type === 'slides') && <Text className="text-gray-400 text-xs font-medium">Ver conteúdo</Text>}
        </View>
    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-space-dark" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center border-b border-white/10 mb-2">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-white/10">
            <ArrowLeft color="#fff" size={24} />
        </Pressable>
        <Text className="text-starlight text-xl font-bold ml-2">Galeria do Studio</Text>
      </View>

      {/* Filters */}
      <View className="px-4 mb-4">
          <FlatList
             data={FILTER_TABS}
             horizontal
             showsHorizontalScrollIndicator={false}
             keyExtractor={item => item.id}
             renderItem={({ item }) => {
                 const isActive = activeFilter === item.id;
                 return (
                     <Pressable
                        onPress={() => setActiveFilter(item.id)}
                        className={`mr-3 px-4 py-2 rounded-full border ${isActive ? 'bg-cosmic-purple border-cosmic-purple' : 'bg-transparent border-white/20'}`}
                     >
                         <Text className={`${isActive ? 'text-white' : 'text-gray-400'} font-medium`}>{item.label}</Text>
                     </Pressable>
                 );
             }}
          />
      </View>

      {/* Grid */}
      <FlatList
          data={filteredData}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
