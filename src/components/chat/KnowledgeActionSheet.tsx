import { useRouter } from 'expo-router';
import {
  Book,
  BookOpen,
  FileQuestion,
  Headphones,
  Maximize2,
  Monitor,
  Table
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View
} from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { ArtifactConfigModal } from '../../components/studio/ArtifactConfigModal';
import { studioService } from '../../services/studioService';
import { ArtifactGenerationOptions, ArtifactType, KnowledgeArtifact } from '../../types/studio';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface KnowledgeActionSheetProps {
  onClose?: () => void;
  chatId?: string;
}

// Feature Flags - Desabilita features que ainda não estão prontas no backend
const FEATURE_FLAGS = {
  enablePresentations: false, // SLIDE
  enableSpreadsheets: false,  // SPREADSHEET
};

// Updated Generators
const ALL_GENERATORS: { id: ArtifactType; label: string; icon: any; color: string; bg: string; border: string }[] = [
  { id: 'PODCAST', label: 'Podcast', icon: Headphones, color: '#818cf8', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'SLIDE', label: 'Apresentações', icon: Monitor, color: '#fbbf24', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { id: 'QUIZ', label: 'Quiz', icon: FileQuestion, color: '#2dd4bf', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  { id: 'FLASHCARD', label: 'Flashcards', icon: BookOpen, color: '#f472b6', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  { id: 'SPREADSHEET', label: 'Tabelas', icon: Table, color: '#34d399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { id: 'WORKBOOK', label: 'Apostila', icon: Book, color: '#60a5fa', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
];

// Filtrar generators baseado nas feature flags
const GENERATORS = ALL_GENERATORS.filter(gen => {
  if (gen.id === 'SLIDE' && !FEATURE_FLAGS.enablePresentations) return false;
  if (gen.id === 'SPREADSHEET' && !FEATURE_FLAGS.enableSpreadsheets) return false;
  return true;
});

export const KnowledgeActionSheet: React.FC<KnowledgeActionSheetProps> = ({ onClose, chatId = '0' }) => {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<KnowledgeArtifact[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal Config State
  const [configVisible, setConfigVisible] = useState(false);
  const [selectedArtifactType, setSelectedArtifactType] = useState<ArtifactType | null>(null);

  const fetchArtifacts = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await studioService.getArtifacts(chatId);
      setArtifacts(data.slice(0, 5)); // Show only recent few
    } catch (e) {
      console.error("Failed to load artifacts", e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Load recent artifacts
  useEffect(() => {
    fetchArtifacts(true);
  }, [chatId]);

  // Polling for processing artifacts
  useEffect(() => {
    const hasProcessing = artifacts.some(a => a.status === 'processing');
    let interval: ReturnType<typeof setInterval>;

    if (hasProcessing) {
      interval = setInterval(() => {
        fetchArtifacts(false);
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [artifacts]);

  const handlePressGenerator = (gen: typeof GENERATORS[0]) => {
    // Open configuration modal for ALL types
    setSelectedArtifactType(gen.id);
    setConfigVisible(true);
  };

  const handleConfigConfirm = (options: ArtifactGenerationOptions) => {
    if (!selectedArtifactType) return;
    const gen = GENERATORS.find(g => g.id === selectedArtifactType);
    if (gen) {
      executeGenerate(gen, options);
    }
  };

  const executeGenerate = async (gen: typeof GENERATORS[0], options?: ArtifactGenerationOptions) => {
    // Optimistic Update
    const tempId = -Date.now();
    const tempArtifact: KnowledgeArtifact = {
      id: tempId,
      chat: parseInt(chatId, 10) || 0,
      type: gen.id,
      title: 'Gerando...',
      status: 'processing',
      created_at: new Date().toISOString()
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArtifacts(prev => [tempArtifact, ...prev]);

    try {
      // Call Service
      // Note: Backend now generates the title.
      const created = await studioService.generateArtifact(chatId, gen.id, gen.label, options);

      // Wait for next polling cycle to update or update immediately if returned?
      // studioService.generateArtifact usually returns the Created (Processing) artifact or the result if synchronous (unlikely).
      // Since it's async thread, it returns Processing state.
      // We rely on polling to flip it to Ready.
      // But we update the ID here so key matches.

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setArtifacts(prev => prev.map(a => a.id === tempId ? created : a));

    } catch (error) {
      console.error("Generation failed", error);
      // Error: Remove optimistic item
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setArtifacts(prev => prev.filter(a => a.id !== tempId));
      Alert.alert("Erro", "Não foi possível gerar o artefato. Tente novamente.");
    }
  };

  const handleSeeAll = () => {
    onClose?.();
    router.push({
      pathname: '/studio/gallery',
      params: { chatId }
    });
  };

  const handleOpenArtifact = (item: KnowledgeArtifact) => {
    onClose?.();
    router.push({
      pathname: '/studio/gallery',
      params: { chatId, openArtifactId: item.id.toString() }
    });
  };

  const ArtifactItem = ({ item }: { item: KnowledgeArtifact }) => {
    // Usa ALL_GENERATORS para encontrar o tipo correto, mesmo que esteja oculto
    const gen = ALL_GENERATORS.find(g => g.id === item.type) || ALL_GENERATORS[0];
    const Icon = gen.icon;

    return (
      <Animated.View
        layout={Layout.springify()}
        entering={FadeIn}
        className="mr-3"
      >
        <Pressable
          onPress={() => handleOpenArtifact(item)}
          disabled={item.status === 'processing'}
          className={`items-center justify-center p-3 rounded-2xl bg-space-light border border-white/10 w-[100px] h-[100px] relative overflow-hidden active:opacity-60`}
        >
          <View className="mb-2 opacity-80">
            <Icon color={gen.color} size={28} />
          </View>

          {item.status === 'processing' && (
            <View className="absolute inset-0 items-center justify-center bg-space-dark/60 z-10">
              <ActivityIndicator color="#fff" size="small" />
            </View>
          )}

          <Text className="text-starlight text-[10px] text-center font-medium leading-tight" numberOfLines={2}>
            {item.title}
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <>
      <View className="w-full bg-space-dark/95 border-t border-white/10 rounded-t-[32px] pb-8 pt-2 absolute bottom-0 shadow-2xl z-50">
        {/* Handle Bar */}
        <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6" />

        {/* 1. Generated Artifacts Rail (Outputs) */}
        <View className="mb-6 pl-6">
          <View className="flex-row justify-between items-center pr-6 mb-3">
            <Text className="text-gray-400 text-sm font-medium">Mídia Gerada & Fontes</Text>
            <Pressable onPress={handleSeeAll} className="flex-row items-center active:opacity-60">
              <Text className="text-cosmic-purple text-xs font-bold mr-1">Ver Galeria Completa</Text>
              <Maximize2 color="#818cf8" size={12} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
            {loading ? (
              <ActivityIndicator color="#818cf8" size="small" className="ml-4" />
            ) : artifacts.length === 0 ? (
              <View className="w-[120px] h-[100px] items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5 mr-6 px-4">
                <Text className="text-gray-500 text-xs text-center">Nenhum conteúdo gerado ainda.</Text>
              </View>
            ) : (
              artifacts.map(item => (
                <ArtifactItem key={item.id} item={item} />
              ))
            )}
          </ScrollView>
        </View>

        {/* 2. Generators Grid (Inputs) */}
        <View className="px-6">
          <Text className="text-starlight text-lg font-bold mb-4">Gerar novos</Text>
          <View className="flex-row flex-wrap gap-3">
            {GENERATORS.map((gen) => (
              <Pressable
                key={gen.id}
                onPress={() => handlePressGenerator(gen)}
                className={`flex-grow basis-[45%] flex-row items-center p-4 rounded-2xl border ${gen.border} ${gen.bg} active:opacity-80`}
              >
                <View className="p-2 rounded-full bg-white/10 mr-3">
                  <gen.icon size={20} color={gen.color} />
                </View>
                <Text className="text-starlight font-bold text-sm flex-1" numberOfLines={1}>{gen.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Configuration Modal */}
      {selectedArtifactType && (
        <ArtifactConfigModal
          visible={configVisible}
          onClose={() => setConfigVisible(false)}
          onGenerate={handleConfigConfirm}
          artifactType={selectedArtifactType}
          chatId={chatId}
        />
      )}
    </>
  );
};
