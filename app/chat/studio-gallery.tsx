import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Headphones,
  BookOpen,
  FileQuestion,
  FileText,
  Lightbulb,
  Play
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { studioService } from '../../src/services/studioService';
import { KnowledgeArtifact, ArtifactType } from '../../src/types/studio';

const FILTER_TABS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PODCAST', label: 'Áudio' },
  { id: 'FLASHCARD', label: 'Cards' },
  { id: 'QUIZ', label: 'Quiz' },
];

export default function StudioGalleryScreen() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams();
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [artifacts, setArtifacts] = useState<KnowledgeArtifact[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
      setLoading(true);
      try {
        const data = await studioService.getArtifacts(chatId as string || 'mock-id');
        setArtifacts(data);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useFocusEffect(
      useCallback(() => {
          loadData();
      }, [chatId])
  );

  const filteredData = activeFilter === 'ALL'
    ? artifacts
    : artifacts.filter(item => {
        if (activeFilter === 'PODCAST') return item.type === 'PODCAST';
        if (activeFilter === 'FLASHCARD') return item.type === 'FLASHCARD' || item.type === 'SUMMARY' || item.type === 'SLIDE'; // Group text-ish
        if (activeFilter === 'QUIZ') return item.type === 'QUIZ';
        return true;
    });

  const getMetadata = (item: KnowledgeArtifact) => {
      const color = getColor(item.type);
      const icon = getIcon(item.type, color);
      return { color, icon };
  };

  const getColor = (type: ArtifactType) => {
      switch(type) {
          case 'PODCAST': return '#818cf8';
          case 'QUIZ': return '#2dd4bf';
          case 'FLASHCARD': return '#f472b6';
          case 'SLIDE': return '#fbbf24';
          case 'SUMMARY': return '#c084fc';
          default: return '#94a3b8';
      }
  };

  const getIcon = (type: ArtifactType, color: string) => {
      switch(type) {
          case 'PODCAST': return <Headphones color={color} size={24} />;
          case 'QUIZ': return <FileQuestion color={color} size={24} />;
          case 'FLASHCARD': return <BookOpen color={color} size={24} />;
          case 'SLIDE': return <Lightbulb color={color} size={24} />;
          default: return <FileText color={color} size={24} />;
      }
  };

  const renderItem = ({ item, index }: { item: KnowledgeArtifact, index: number }) => {
    const { color, icon } = getMetadata(item);
    const dateStr = formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true, locale: ptBR });

    return (
        <Animated.View
        entering={FadeInDown.delay(index * 50)}
        className="flex-1 m-2 p-4 bg-space-light rounded-2xl border border-white/10 min-h-[140px] justify-between"
        >
            <View className="flex-row justify-between items-start">
                <View className="p-2 bg-white/5 rounded-full">
                    {icon}
                </View>
                {item.type === 'PODCAST' && (
                    <Pressable className="p-1.5 bg-cosmic-purple/20 rounded-full">
                        <Play size={12} color="#818cf8" fill="#818cf8" />
                    </Pressable>
                )}
                {item.type === 'QUIZ' && item.score && (
                    <View className="px-2 py-1 bg-teal-500/20 rounded-lg">
                        <Text className="text-teal-400 text-xs font-bold">{item.score}</Text>
                    </View>
                )}
            </View>

            <View>
                <Text className="text-starlight font-bold text-base leading-tight mb-1" numberOfLines={2}>
                    {item.title}
                </Text>
                <Text className="text-gray-500 text-xs">{dateStr}</Text>
            </View>

            {/* Footer info based on type */}
            <View className="mt-2 pt-2 border-t border-white/5">
                {item.type === 'PODCAST' && <Text className="text-gray-400 text-xs font-medium">{item.duration || '00:00'} min</Text>}
                {item.type === 'QUIZ' && <Text className="text-gray-400 text-xs font-medium">Revisar</Text>}
                {item.type === 'FLASHCARD' && <Text className="text-gray-400 text-xs font-medium">{Array.isArray(item.content) ? item.content.length : 0} cards</Text>}
                {(item.type === 'SUMMARY' || item.type === 'SLIDE') && <Text className="text-gray-400 text-xs font-medium">Ver conteúdo</Text>}
            </View>
        </Animated.View>
    );
  };

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
      {loading ? (
          <View className="flex-1 justify-center items-center">
              <ActivityIndicator color="#818cf8" size="large" />
          </View>
      ) : (
        <FlatList
            data={filteredData}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            numColumns={2}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
                <View className="items-center mt-20">
                    <Text className="text-gray-500">Nenhum artefato encontrado.</Text>
                </View>
            }
        />
      )}
    </SafeAreaView>
  );
}
