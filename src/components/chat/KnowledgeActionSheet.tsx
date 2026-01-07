import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import {
  Headphones,
  BookOpen,
  FileQuestion,
  FileText,
  Lightbulb,
  Maximize2,
  Monitor
} from 'lucide-react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { useRouter, Href } from 'expo-router';
import { studioService } from '../../services/studioService';
import { KnowledgeArtifact, ArtifactType } from '../../types/studio';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface KnowledgeActionSheetProps {
  onClose?: () => void;
  chatId?: string;
}

// Updated Generators based on Task 2:
// Podcast (🎙️), Slides (🖥️), Quiz (🧠), Flashcards (📚), Resumo (📝)
const GENERATORS: { id: ArtifactType; label: string; icon: any; color: string; bg: string; border: string }[] = [
  { id: 'PODCAST', label: 'Podcast', icon: Headphones, color: '#818cf8', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'SLIDE', label: 'Slides', icon: Monitor, color: '#fbbf24', bg: 'bg-amber-500/10', border: 'border-amber-500/20' }, // Using Monitor for "Slides" (🖥️)
  { id: 'QUIZ', label: 'Quiz', icon: FileQuestion, color: '#2dd4bf', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  { id: 'FLASHCARD', label: 'Flashcards', icon: BookOpen, color: '#f472b6', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  { id: 'SUMMARY', label: 'Resumo', icon: FileText, color: '#c084fc', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
];

export const KnowledgeActionSheet: React.FC<KnowledgeActionSheetProps> = ({ onClose, chatId = 'mock-id' }) => {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<KnowledgeArtifact[]>([]);
  const [loading, setLoading] = useState(false);

  // Load recent artifacts
  useEffect(() => {
     setLoading(true);
     studioService.getArtifacts(chatId).then(data => {
         setArtifacts(data.slice(0, 5)); // Show only recent few
         setLoading(false);
     });
  }, [chatId]);

  const handleGenerate = async (gen: typeof GENERATORS[0]) => {
    // Optimistic Update
    const tempId = Date.now().toString();
    const tempArtifact: KnowledgeArtifact = {
        id: tempId,
        chatId,
        type: gen.id,
        title: gen.label,
        status: 'processing',
        createdAt: new Date().toISOString()
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArtifacts(prev => [tempArtifact, ...prev]);

    // Call Service
    const created = await studioService.generateArtifact(chatId, gen.id, gen.label);

    // Update with real object (or simulate finish after delay within component for visual feedback)
    setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setArtifacts(prev => prev.map(a => a.id === tempId ? { ...a, status: 'ready' } : a));
    }, 4000); // Visual sync with mock service delay
  };

  const handleSeeAll = () => {
    onClose?.();
    router.push({
      pathname: '/chat/studio-gallery' as Href<string>,
      params: { chatId }
    });
  };

  const ArtifactItem = ({ item }: { item: KnowledgeArtifact }) => {
     const gen = GENERATORS.find(g => g.id === item.type) || GENERATORS[0];
     const Icon = gen.icon;

     return (
        <Animated.View
          layout={Layout.springify()}
          entering={FadeIn}
          className={`mr-3 items-center justify-center p-3 rounded-2xl bg-space-light border border-white/10 w-[100px] h-[100px] relative overflow-hidden`}
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
        </Animated.View>
     );
  };

  return (
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
                onPress={() => handleGenerate(gen)}
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
  );
};
