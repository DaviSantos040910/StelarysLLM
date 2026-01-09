import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ChevronDown, X, Download } from 'lucide-react-native';
import { useMinimizedStore } from '../../stores/minimizedStore';
import { KnowledgeArtifact } from '../../types/studio';
import { RichTextToolbar } from './RichTextToolbar';

interface Props {
  data: string; // The text content
  artifact: KnowledgeArtifact;
  onClose: () => void;
  onExport: () => void;
}

export const NoteViewer: React.FC<Props> = ({ data, artifact, onClose, onExport }) => {
  const { minimize, close: closeStore } = useMinimizedStore();
  const [text, setText] = useState(data);

  // Mock styles state (in real app, use a Rich Text Editor lib)
  const [styles, setStyles] = useState<{ color?: string, backgroundColor?: string }>({});

  const handleMinimize = () => {
    minimize(artifact);
    onClose(); // Close the modal visually
  };

  const handleClose = () => {
    closeStore(); // Clear from store
    onClose(); // Close modal
  };

  const handleStylePress = (style: string, value?: string) => {
      console.log(`Applying style: ${style} with value: ${value}`);
      // Mock visual feedback
      if (style === 'color') setStyles(prev => ({ ...prev, color: value }));
      if (style === 'highlight') setStyles(prev => ({ ...prev, backgroundColor: value ? value + '40' : undefined })); // 25% opacity
  };

  return (
    <View className="flex-1 bg-space-dark">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-white/10">
          <Pressable onPress={handleMinimize} className="p-2 rounded-full active:bg-white/10">
              <ChevronDown color="#94a3b8" size={24} />
          </Pressable>

          <Text className="text-starlight font-bold text-lg flex-1 text-center" numberOfLines={1}>
              {artifact.title}
          </Text>

          <View className="flex-row gap-2">
              <Pressable onPress={onExport} className="p-2 rounded-full active:bg-white/10">
                  <Download color="#94a3b8" size={24} />
              </Pressable>
              <Pressable onPress={handleClose} className="p-2 rounded-full active:bg-white/10">
                  <X color="#ef4444" size={24} />
              </Pressable>
          </View>
      </View>

      {/* Editor Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
          <ScrollView className="flex-1 px-4 py-4">
              <TextInput
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder="Escreva sua nota aqui..."
                  placeholderTextColor="#64748b"
                  className="text-lg leading-8"
                  style={{
                      color: styles.color || '#e2e8f0',
                      backgroundColor: styles.backgroundColor,
                      minHeight: 300,
                      textAlignVertical: 'top'
                  }}
              />
          </ScrollView>

          {/* Toolbar */}
          <RichTextToolbar onStylePress={handleStylePress} />
      </KeyboardAvoidingView>
    </View>
  );
};
