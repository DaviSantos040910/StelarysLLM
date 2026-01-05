import React, { useState } from 'react';
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
  Maximize2
} from 'lucide-react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ArtifactStatus = 'loading' | 'ready';
type ArtifactType = 'podcast' | 'guide' | 'quiz' | 'summary' | 'briefing';

interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
}

interface KnowledgeActionSheetProps {
  onClose?: () => void;
  chatId?: string;
}

const GENERATORS = [
  { id: 'podcast', label: 'Resumo em Áudio', icon: Headphones, color: '#818cf8', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'guide', label: 'Cartões de estudo', icon: BookOpen, color: '#f472b6', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  { id: 'quiz', label: 'Teste', icon: FileQuestion, color: '#2dd4bf', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  { id: 'summary', label: 'Infográfico', icon: FileText, color: '#c084fc', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { id: 'briefing', label: 'Slides', icon: Lightbulb, color: '#fbbf24', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
];

export const KnowledgeActionSheet: React.FC<KnowledgeActionSheetProps> = ({ onClose, chatId }) => {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const handleGenerate = (gen: typeof GENERATORS[0]) => {
    const id = Date.now().toString();
    const newArtifact: Artifact = {
      id,
      type: gen.id as ArtifactType,
      title: gen.label,
      status: 'loading'
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArtifacts(prev => [newArtifact, ...prev]);

    // Mock generation
    setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setArtifacts(prev => prev.map(item =>
        item.id === id ? { ...item, status: 'ready' } : item
      ));
    }, 3000);
  };

  const handleSeeAll = () => {
    onClose?.();
    router.push({
      pathname: '/chat/studio-gallery',
      params: { chatId }
    });
  };

  const ArtifactItem = ({ item }: { item: Artifact }) => (
    <Animated.View
      layout={Layout.springify()}
      entering={FadeIn}
      className={`mr-3 items-center justify-center p-3 rounded-2xl bg-space-light border border-white/10 w-[100px] h-[100px] relative overflow-hidden`}
    >
      <View className="mb-2 opacity-80">
        {item.type === 'podcast' && <Headphones color="#818cf8" size={28} />}
        {item.type === 'guide' && <BookOpen color="#f472b6" size={28} />}
        {item.type === 'quiz' && <FileQuestion color="#2dd4bf" size={28} />}
        {item.type === 'summary' && <FileText color="#c084fc" size={28} />}
        {item.type === 'briefing' && <Lightbulb color="#fbbf24" size={28} />}
      </View>

      {item.status === 'loading' && (
        <View className="absolute inset-0 items-center justify-center bg-space-dark/60 z-10">
           <ActivityIndicator color="#fff" size="small" />
        </View>
      )}

      <Text className="text-starlight text-[10px] text-center font-medium leading-tight" numberOfLines={2}>
        {item.title}
      </Text>
    </Animated.View>
  );

  return (
    <View className="w-full bg-space-dark/95 border-t border-white/10 rounded-t-[32px] pb-8 pt-2 absolute bottom-0 shadow-2xl z-50">
      {/* Handle Bar */}
      <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6" />

      {/* 1. Generated Artifacts Rail (Outputs) */}
      <View className="mb-6 pl-6">
        <View className="flex-row justify-between items-center pr-6 mb-3">
             <Text className="text-gray-400 text-sm font-medium">Mídia Gerada & Fontes</Text>
             {artifacts.length > 0 && (
                 <Pressable onPress={handleSeeAll} className="flex-row items-center active:opacity-60">
                     <Text className="text-cosmic-purple text-xs font-bold mr-1">Ver tudo</Text>
                     <Maximize2 color="#818cf8" size={12} />
                 </Pressable>
             )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
          {artifacts.length === 0 ? (
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
