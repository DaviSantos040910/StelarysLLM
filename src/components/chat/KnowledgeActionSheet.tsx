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
  AppState,
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
import { themeClasses } from '../../theme/classes';

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

const STAGE_LABELS: Record<string, string> = {
  queued: 'Na fila',
  analyzing: 'Lendo...',
  generating: 'Criando...',
  validating: 'Validando',
  formatting: 'Formatando',
  uploading: 'Salvando',
  processing: 'Gerando...'
};

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
        // Intelligent Polling: Only poll if app is active
        if (AppState.currentState === 'active') {
          fetchArtifacts(false);
        }
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
    // Determine title base
    // If options.title is present (from dynamic generator), use it appended to Type
    // e.g. "Podcast — Aula 1"
    // Otherwise fallback to "Podcast — Chat History" or just "Podcast"
    let displayTitle = 'Gerando...';
    let requestTitle = gen.label;

    if (options?.title) {
        requestTitle = `${gen.label} — ${options.title}`;
        displayTitle = requestTitle;
    } else {
        // Fallback for direct generation without modal (if any)
        requestTitle = `${gen.label}`;
    }

    // Optimistic Update
    const tempId = -Date.now();
    const tempArtifact: KnowledgeArtifact = {
      id: tempId,
      chat: parseInt(chatId, 10) || 0,
      type: gen.id,
      title: displayTitle,
      status: 'processing',
      created_at: new Date().toISOString()
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArtifacts(prev => [tempArtifact, ...prev]);

    try {
      const created = await studioService.generateArtifact(chatId, gen.id, requestTitle, options);

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
    const isError = item.status === 'error';

    return (
      <Animated.View
        layout={Layout.springify()}
        entering={FadeIn}
        className="mr-3"
      >
        <Pressable
          onPress={() => isError ? Alert.alert("Erro na Geração", item.error_message || "Ocorreu um erro ao gerar o artefato.") : handleOpenArtifact(item)}
          disabled={item.status === 'processing'}
          className={`items-center justify-center p-3 rounded-2xl ${isError ? 'bg-red-50 dark:bg-red-900/10 border-red-500' : 'bg-white dark:bg-space-light border-gray-200 dark:border-white/10'} border w-[100px] h-[100px] relative overflow-hidden active:opacity-60 shadow-sm`}
        >
          <View className={`mb-2 opacity-80 ${isError ? 'opacity-50' : ''}`}>
            <Icon color={isError ? '#ef4444' : gen.color} size={28} />
          </View>

          {item.status === 'processing' && (
            <View className="absolute inset-0 items-center justify-center bg-white/95 dark:bg-space-dark/95 z-10 px-1">
              <ActivityIndicator color="#818cf8" size="small" className="mb-1" />
              <Text className="text-[9px] text-center text-cosmic-purple font-medium" numberOfLines={2}>
                 {STAGE_LABELS[item.current_step || 'processing'] || STAGE_LABELS['processing']}
              </Text>
            </View>
          )}

          <Text className={`${isError ? 'text-red-500' : themeClasses.textPrimary} text-[10px] text-center font-medium leading-tight`} numberOfLines={2}>
            {item.title}
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <>
      <View className="w-full bg-white/95 dark:bg-space-dark/95 border-t border-gray-200 dark:border-white/10 rounded-t-[32px] pb-8 pt-2 absolute bottom-0 shadow-2xl z-50">
        {/* Handle Bar */}
        <View className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full self-center mb-6" />

        {/* 1. Generated Artifacts Rail (Outputs) */}
        <View className="mb-6 pl-6">
          <View className="flex-row justify-between items-center pr-6 mb-3">
            <Text className={`${themeClasses.textSecondary} text-sm font-medium`}>Mídia Gerada & Fontes</Text>
            <Pressable onPress={handleSeeAll} className="flex-row items-center active:opacity-60">
              <Text className="text-cosmic-purple text-xs font-bold mr-1">Ver Galeria Completa</Text>
              <Maximize2 color="#818cf8" size={12} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
            {loading ? (
              <ActivityIndicator color="#818cf8" size="small" className="ml-4" />
            ) : artifacts.length === 0 ? (
              <View className={`w-[120px] h-[100px] items-center justify-center border border-dashed border-gray-300 dark:border-white/10 rounded-2xl ${themeClasses.softSurface} mr-6 px-4`}>
                <Text className={`${themeClasses.textMuted} text-xs text-center`}>Nenhum conteúdo gerado ainda.</Text>
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
          <Text className={`${themeClasses.textPrimary} text-lg font-bold mb-4`}>Gerar novos</Text>
          <View className="flex-row flex-wrap gap-3">
            {GENERATORS.map((gen) => (
              <Pressable
                key={gen.id}
                onPress={() => handlePressGenerator(gen)}
                className={`flex-grow basis-[45%] flex-row items-center p-4 rounded-2xl border ${gen.border} ${gen.bg} active:opacity-80`}
              >
                <View className="p-2 rounded-full bg-white/50 dark:bg-white/10 mr-3">
                  <gen.icon size={20} color={gen.color} />
                </View>
                <Text className={`${themeClasses.textPrimary} font-bold text-sm flex-1`} numberOfLines={1}>{gen.label}</Text>
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
