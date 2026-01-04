import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Keyboard
} from 'react-native';
import {
  Link,
  FileText,
  File,
  Mic,
  Headphones,
  X,
  Check,
  Plus,
  Image as ImageIcon
} from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Types for our artifacts
type ArtifactStatus = 'loading' | 'ready';
interface Artifact {
  id: string;
  type: 'podcast' | 'file' | 'link' | 'text';
  title: string;
  status: ArtifactStatus;
}

interface KnowledgeActionSheetProps {
  onClose?: () => void;
}

export const KnowledgeActionSheet: React.FC<KnowledgeActionSheetProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'menu' | 'text-editor' | 'link-editor'>('menu');
  const [inputText, setInputText] = useState('');
  const [artifacts, setArtifacts] = useState<Artifact[]>([
    // Initial mock data to populate the rail
    { id: '1', type: 'file', title: 'Calculus_101.pdf', status: 'ready' },
  ]);

  const inputRef = useRef<TextInput>(null);

  // Focus input when entering editor mode
  useEffect(() => {
    if (mode !== 'menu') {
      // Small delay to allow layout animation to start
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      Keyboard.dismiss();
    }
  }, [mode]);

  const toggleMode = (newMode: 'menu' | 'text-editor' | 'link-editor') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(newMode);
    setInputText('');
  };

  const handleSave = () => {
    if (!inputText.trim()) {
      toggleMode('menu');
      return;
    }

    const newArtifact: Artifact = {
      id: Date.now().toString(),
      type: mode === 'link-editor' ? 'link' : 'text',
      title: mode === 'link-editor' ? inputText : 'Nova Nota de Texto', // Simplification
      status: 'ready'
    };

    setArtifacts(prev => [newArtifact, ...prev]);
    toggleMode('menu');
  };

  const handleGeneratePodcast = () => {
    const id = Date.now().toString();
    // Add "Ghost" item
    const ghostItem: Artifact = {
      id,
      type: 'podcast',
      title: 'Gerando Podcast...',
      status: 'loading'
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArtifacts(prev => [ghostItem, ...prev]);

    // Simulate API call
    setTimeout(() => {
      setArtifacts(prev => prev.map(item =>
        item.id === id
          ? { ...item, status: 'ready', title: 'Resumo em Áudio' }
          : item
      ));
    }, 3000);
  };

  // --- Components ---

  const ArtifactItem = ({ item }: { item: Artifact }) => (
    <Animated.View
      layout={Layout.springify()}
      entering={FadeIn}
      className={`mr-3 items-center justify-center p-4 rounded-2xl bg-space-light border border-white/10 w-[100px] h-[100px] ${item.status === 'loading' ? 'opacity-50' : ''}`}
    >
      <View className="mb-2">
        {item.type === 'podcast' && <Headphones color="#818cf8" size={32} />}
        {item.type === 'file' && <File color="#94a3b8" size={32} />}
        {item.type === 'link' && <Link color="#94a3b8" size={32} />}
        {item.type === 'text' && <FileText color="#94a3b8" size={32} />}
      </View>

      {item.status === 'loading' && (
        <View className="absolute inset-0 items-center justify-center bg-black/20 rounded-2xl">
           <ActivityIndicator color="#fff" />
        </View>
      )}

      <Text className="text-starlight text-xs text-center font-medium" numberOfLines={2}>
        {item.title}
      </Text>
    </Animated.View>
  );

  const ActionButton = ({
    icon: Icon,
    label,
    onPress,
    color = "#fff"
  }: {
    icon: any,
    label: string,
    onPress: () => void,
    color?: string
  }) => (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center bg-white/5 rounded-2xl p-4 active:bg-white/10 space-y-2 aspect-square"
    >
      <Icon color={color} size={28} />
      <Text className="text-starlight text-sm font-medium">{label}</Text>
    </Pressable>
  );

  return (
    <View className="w-full bg-space-dark/95 border-t border-white/10 rounded-t-[32px] pb-8 pt-2 absolute bottom-0 shadow-2xl">
      {/* Handle Bar */}
      <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6" />

      {/* 1. Generated Artifacts Rail (Outputs) */}
      <View className="mb-8 pl-6">
        <Text className="text-gray-400 text-sm font-medium mb-3">Mídia Gerada & Fontes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {/* Special "Add Podcast" Button if not generating */}
          <Pressable
            onPress={handleGeneratePodcast}
            className="mr-3 items-center justify-center p-4 rounded-2xl bg-cosmic-purple/20 border border-cosmic-purple/50 w-[100px] h-[100px] border-dashed"
          >
             <Headphones color="#818cf8" size={32} />
             <Text className="text-cosmic-purple text-xs text-center font-bold mt-2">Gerar Podcast</Text>
          </Pressable>

          {artifacts.map(item => (
            <ArtifactItem key={item.id} item={item} />
          ))}
        </ScrollView>
      </View>

      {/* 2. Mode Content (Inputs) */}
      <View className="px-6 min-h-[220px]">
        {mode === 'menu' ? (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Text className="text-gray-400 text-sm font-medium mb-3">Adicionar Conhecimento</Text>
            <View className="flex-row gap-4 mb-4">
               <ActionButton icon={FileText} label="Texto" onPress={() => toggleMode('text-editor')} />
               <ActionButton icon={Link} label="Link" onPress={() => toggleMode('link-editor')} />
               <ActionButton icon={File} label="Arquivo" onPress={() => {}} />
            </View>
            <View className="flex-row gap-4">
               <ActionButton icon={Mic} label="Áudio" onPress={() => {}} />
               <ActionButton icon={ImageIcon} label="Imagem" onPress={() => {}} />
               <View className="flex-1" /> {/* Spacer to keep grid aligned */}
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn} exiting={FadeOut} className="flex-1">
             <View className="flex-row items-center justify-between mb-4">
                <Text className="text-starlight text-lg font-bold">
                  {mode === 'text-editor' ? 'Nova Nota' : 'Adicionar Link'}
                </Text>
                <Pressable onPress={() => toggleMode('menu')} className="p-2 bg-white/10 rounded-full">
                  <X color="#fff" size={20} />
                </Pressable>
             </View>

             <TextInput
               ref={inputRef}
               className="flex-1 bg-white/5 text-starlight rounded-2xl p-4 text-base min-h-[120px]"
               placeholder={mode === 'text-editor' ? "Digite sua nota aqui..." : "Cole o link aqui..."}
               placeholderTextColor="#64748b"
               multiline
               textAlignVertical="top"
               value={inputText}
               onChangeText={setInputText}
             />

             <View className="flex-row justify-end mt-4">
                <Pressable
                  onPress={handleSave}
                  className="bg-cosmic-purple px-6 py-3 rounded-xl flex-row items-center"
                >
                   <Check color="#fff" size={20} className="mr-2" />
                   <Text className="text-white font-bold">Salvar</Text>
                </Pressable>
             </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
};
