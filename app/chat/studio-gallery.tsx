import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Headphones,
  BookOpen,
  FileQuestion,
  FileText,
  Lightbulb,
  Play,
  Monitor,
  X,
  Table,
  Book,
  Download
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Sharing from 'expo-sharing';

import { studioService } from '../../src/services/studioService';
import { KnowledgeArtifact, ArtifactType, SlidePage, QuizQuestion, FlashcardItem, getExportFormat } from '../../src/types/studio';

// Viewers
import { SlideViewer } from '../../src/components/studio/SlideViewer';
import { QuizViewer } from '../../src/components/studio/QuizViewer';
import { FlashcardViewer } from '../../src/components/studio/FlashcardViewer';
import { PodcastPlayer } from '../../src/components/studio/PodcastPlayer';
import { SpreadsheetViewer } from '../../src/components/studio/SpreadsheetViewer';
import { WorkbookViewer } from '../../src/components/studio/WorkbookViewer';

const FILTER_TABS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PODCAST', label: 'Áudio' },
  { id: 'DOCS', label: 'Docs' },
  { id: 'QUIZ', label: 'Quiz' },
];

export default function StudioGalleryScreen() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams();
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [artifacts, setArtifacts] = useState<KnowledgeArtifact[]>([]);
  const [loading, setLoading] = useState(true);

  // Viewer State
  const [selectedArtifact, setSelectedArtifact] = useState<KnowledgeArtifact | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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
        if (activeFilter === 'DOCS') return ['FLASHCARD', 'SUMMARY', 'SLIDE', 'SPREADSHEET', 'WORKBOOK'].includes(item.type);
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
          case 'SPREADSHEET': return '#34d399';
          case 'WORKBOOK': return '#60a5fa';
          default: return '#94a3b8';
      }
  };

  const getIcon = (type: ArtifactType, color: string) => {
      switch(type) {
          case 'PODCAST': return <Headphones color={color} size={24} />;
          case 'QUIZ': return <FileQuestion color={color} size={24} />;
          case 'FLASHCARD': return <BookOpen color={color} size={24} />;
          case 'SLIDE': return <Monitor color={color} size={24} />;
          case 'SPREADSHEET': return <Table color={color} size={24} />;
          case 'WORKBOOK': return <Book color={color} size={24} />;
          default: return <FileText color={color} size={24} />;
      }
  };

  const handleExport = async () => {
      if (!selectedArtifact) return;

      setIsExporting(true);
      try {
          const format = getExportFormat(selectedArtifact.type);
          // 1. Request backend generation/download
          const localUri = await studioService.exportArtifact(selectedArtifact.id, format);

          // 2. Share/Save
          if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(localUri);
          } else {
              Alert.alert("Sucesso", "Arquivo salvo em: " + localUri);
          }
      } catch (error) {
          console.error(error);
          Alert.alert("Erro", "Falha ao exportar arquivo.");
      } finally {
          setIsExporting(false);
      }
  };

  const renderItem = ({ item, index }: { item: KnowledgeArtifact, index: number }) => {
    const { color, icon } = getMetadata(item);
    const dateStr = formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true, locale: ptBR });

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 50)}
            className="flex-1 m-2"
        >
            <Pressable
                onPress={() => setSelectedArtifact(item)}
                className="flex-1 p-4 bg-space-light rounded-2xl border border-white/10 min-h-[140px] justify-between active:bg-white/5 transition-colors"
            >
                <View className="flex-row justify-between items-start">
                    <View className="p-2 bg-white/5 rounded-full">
                        {icon}
                    </View>
                    {item.type === 'PODCAST' && (
                        <View className="p-1.5 bg-cosmic-purple/20 rounded-full">
                            <Play size={12} color="#818cf8" fill="#818cf8" />
                        </View>
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

                <View className="mt-2 pt-2 border-t border-white/5">
                    {item.type === 'PODCAST' && <Text className="text-gray-400 text-xs font-medium">{item.duration || '00:00'} min</Text>}
                    {item.type === 'QUIZ' && <Text className="text-gray-400 text-xs font-medium">Revisar</Text>}
                    {item.type === 'FLASHCARD' && <Text className="text-gray-400 text-xs font-medium">{Array.isArray(item.content) ? item.content.length : 0} cards</Text>}
                    {item.type === 'SLIDE' && <Text className="text-gray-400 text-xs font-medium">{Array.isArray(item.content) ? item.content.length : 0} slides</Text>}
                    {['SUMMARY', 'SPREADSHEET', 'WORKBOOK'].includes(item.type) && <Text className="text-gray-400 text-xs font-medium">Ver conteúdo</Text>}
                </View>
            </Pressable>
        </Animated.View>
    );
  };

  // Render Content based on Type
  const renderViewer = () => {
      if (!selectedArtifact) return null;

      switch(selectedArtifact.type) {
          case 'SLIDE':
              return <SlideViewer data={selectedArtifact.content as SlidePage[]} />;
          case 'QUIZ':
              return <QuizViewer data={selectedArtifact.content as QuizQuestion[]} onFinish={() => setSelectedArtifact(null)} />;
          case 'FLASHCARD':
              return <FlashcardViewer data={selectedArtifact.content as FlashcardItem[]} />;
          case 'PODCAST':
              return <PodcastPlayer uri={selectedArtifact.mediaUrl} title={selectedArtifact.title} />;
          case 'SPREADSHEET':
              return <SpreadsheetViewer />;
          case 'WORKBOOK':
              return <WorkbookViewer />;
          default:
              return (
                  <View className="flex-1 bg-space-dark p-6 pt-20">
                      <Text className="text-starlight text-2xl font-bold mb-4">{selectedArtifact.title}</Text>
                      <Text className="text-gray-300 text-lg leading-8">{selectedArtifact.content as string}</Text>
                  </View>
              );
      }
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

      {/* Artifact Viewer Modal */}
      <Modal
         visible={!!selectedArtifact}
         animationType="slide"
         presentationStyle="pageSheet"
         onRequestClose={() => setSelectedArtifact(null)}
      >
          <View className="flex-1 bg-space-dark relative">
               {/* Header Controls (Close & Export) */}
               <View className="absolute top-4 right-4 z-50 flex-row gap-2">
                   {selectedArtifact && (
                       <Pressable
                          onPress={handleExport}
                          disabled={isExporting}
                          className={`p-2 rounded-full shadow-lg ${isExporting ? 'bg-gray-600' : 'bg-cosmic-purple'}`}
                       >
                           {isExporting ? (
                               <ActivityIndicator color="#fff" size="small" />
                           ) : (
                               <Download color="#fff" size={24} />
                           )}
                       </Pressable>
                   )}
                   <Pressable
                      onPress={() => setSelectedArtifact(null)}
                      className="p-2 bg-black/40 rounded-full"
                   >
                       <X color="#fff" size={24} />
                   </Pressable>
               </View>

               {renderViewer()}
          </View>
      </Modal>

    </SafeAreaView>
  );
}
