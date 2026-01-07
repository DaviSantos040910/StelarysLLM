import React, { useState } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager, Modal, TextInput } from 'react-native';
import { FileText, Music, Globe, Youtube, ChevronUp, ChevronDown, X, Link } from 'lucide-react-native';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut } from 'react-native-reanimated';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: string, data?: any) => void;
}

const MODELS = [
  { id: 'stelarys-pro', name: 'Stelarys Pro 1.5' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-3-5', name: 'Claude 3.5' },
];

export const AttachmentSheet: React.FC<AttachmentSheetProps> = ({ visible, onClose, onSelectOption }) => {
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isModelListOpen, setIsModelListOpen] = useState(false);

  // YouTube Input State
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState('');

  const handleYoutubeSelect = () => {
      // Instead of immediate close, show input
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowUrlInput(true);
  };

  const handleUrlConfirm = () => {
      if (url.trim()) {
          onSelectOption('youtube', { url: url.trim(), type: 'youtube' });
          setUrl('');
          setShowUrlInput(false);
      }
  };

  const handleUrlCancel = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowUrlInput(false);
      setUrl('');
  };

  const handleClose = () => {
      setShowUrlInput(false);
      setIsModelListOpen(false);
      onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Pressable onPress={handleClose} className="absolute inset-0 bg-black/60 z-40" />

      {/* Sheet Container */}
      <Animated.View
        entering={SlideInDown}
        exiting={SlideOutDown}
        className="absolute bottom-0 left-0 right-0 bg-space-dark border-t border-white/10 rounded-t-[32px] z-50 pb-8 overflow-hidden shadow-2xl"
      >
        {/* Header Handle */}
        <View className="items-center pt-3 pb-2">
            <View className="w-12 h-1.5 bg-white/20 rounded-full" />
        </View>

        {showUrlInput ? (
            /* URL Input View */
            <Animated.View entering={FadeIn} className="px-6 py-6 min-h-[250px]">
                 <View className="flex-row items-center justify-between mb-4">
                     <Text className="text-starlight text-lg font-bold">Adicionar Link do YouTube</Text>
                     <Pressable onPress={handleUrlCancel} className="p-2 bg-white/5 rounded-full">
                         <X color="#94a3b8" size={20} />
                     </Pressable>
                 </View>

                 <View className="bg-white/5 border border-white/10 rounded-xl flex-row items-center px-4 py-3 mb-6">
                     <Link color="#94a3b8" size={20} className="mr-3" />
                     <TextInput
                        placeholder="Cole a URL aqui..."
                        placeholderTextColor="#64748b"
                        value={url}
                        onChangeText={setUrl}
                        className="flex-1 text-starlight text-base"
                        autoFocus
                        autoCapitalize="none"
                        keyboardType="url"
                     />
                 </View>

                 <Pressable
                    onPress={handleUrlConfirm}
                    className={`w-full py-4 rounded-xl items-center ${url.trim() ? 'bg-red-500' : 'bg-white/10'}`}
                    disabled={!url.trim()}
                 >
                     <Text className={`font-bold text-base ${url.trim() ? 'text-white' : 'text-gray-500'}`}>Confirmar Link</Text>
                 </Pressable>
            </Animated.View>
        ) : (
            /* Standard Grid View */
            <>
                <View className="px-6 py-6">
                    <Text className="text-gray-400 text-sm font-medium mb-4 ml-1">Adicionar ao Chat</Text>
                    <View className="flex-row flex-wrap justify-between gap-y-4">
                        <MediaButton
                            icon={FileText}
                            label="Arquivos"
                            color="#60a5fa"
                            onPress={() => onSelectOption('files')}
                        />
                        <MediaButton
                            icon={Music}
                            label="Áudio"
                            color="#f472b6"
                            onPress={() => onSelectOption('audio')}
                        />
                        <MediaButton
                            icon={Globe}
                            label="Site"
                            color="#34d399"
                            onPress={() => onSelectOption('website')}
                        />
                        <MediaButton
                            icon={Youtube}
                            label="YouTube"
                            color="#f87171"
                            onPress={handleYoutubeSelect} // Opens Input View
                        />
                    </View>
                </View>

                {/* Divider */}
                <View className="h-[1px] bg-white/5 mx-6 mb-4" />

                {/* Model Footer */}
                <View className="px-6 pb-2 z-50">
                    <View className="flex-row justify-between items-center">
                        <Text className="text-gray-400 font-medium">Modelo</Text>

                        <Pressable
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setIsModelListOpen(!isModelListOpen);
                            }}
                            className="flex-row items-center bg-white/5 px-4 py-2 rounded-full border border-white/10 active:bg-white/10"
                        >
                            <Text className="text-starlight font-bold mr-2">{selectedModel.name}</Text>
                            {isModelListOpen ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronUp size={16} color="#94a3b8" />}
                        </Pressable>
                    </View>

                    {/* Model Popover List */}
                    {isModelListOpen && (
                        <View className="absolute bottom-[60px] right-6 w-[200px] bg-space-light border border-white/10 rounded-xl shadow-xl overflow-hidden">
                            {MODELS.map((model, index) => (
                                <Pressable
                                    key={model.id}
                                    onPress={() => {
                                        setSelectedModel(model);
                                        setIsModelListOpen(false);
                                    }}
                                    className={`p-4 flex-row items-center justify-between ${index !== MODELS.length - 1 ? 'border-b border-white/5' : ''} active:bg-white/5`}
                                >
                                    <Text className={`text-base ${selectedModel.id === model.id ? 'text-cosmic-purple font-bold' : 'text-starlight'}`}>
                                        {model.name}
                                    </Text>
                                    {selectedModel.id === model.id && <View className="w-2 h-2 rounded-full bg-cosmic-purple" />}
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>
            </>
        )}

      </Animated.View>
    </Modal>
  );
};

// Sub-component for Grid Buttons
const MediaButton = ({ icon: Icon, label, color, onPress }: { icon: any, label: string, color: string, onPress: () => void }) => (
    <Pressable
        onPress={onPress}
        className="w-[48%] aspect-[1.4] bg-white/5 border border-white/5 rounded-2xl items-center justify-center space-y-3 active:bg-white/10"
    >
        <View className="p-3 rounded-full bg-white/5">
            <Icon size={28} color={color} />
        </View>
        <Text className="text-starlight font-medium">{label}</Text>
    </Pressable>
);
