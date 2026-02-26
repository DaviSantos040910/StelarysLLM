import React, { useState } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager, Modal, TextInput } from 'react-native';
import { FileText, Music, Globe, Youtube, ChevronUp, ChevronDown, X, Link, Image as ImageIcon, Camera } from 'lucide-react-native';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { useAttachmentPicker } from '../../hooks/useAttachmentPicker';
import { themeClasses } from '../../theme/classes';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption?: (option: string, data?: any) => void;
  onSelect?: (fileOrUrl: any, type: 'file' | 'url' | 'youtube' | 'image' | 'camera') => void;
}

const MODELS = [
  { id: 'stelarys-pro', name: 'Stelarys Pro 1.5' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-3-5', name: 'Claude 3.5' },
];

export const AttachmentSheet: React.FC<AttachmentSheetProps> = ({ visible, onClose, onSelectOption, onSelect }) => {
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isModelListOpen, setIsModelListOpen] = useState(false);

  // URL Input State (Shared for YouTube and Link)
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [inputType, setInputType] = useState<'youtube' | 'website'>('youtube');
  const [url, setUrl] = useState('');

  // Use hook for file picking
  const { pickDocument, pickImage, takePhoto } = useAttachmentPicker();

  const handleUrlSelect = (type: 'youtube' | 'website') => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInputType(type);
      setShowUrlInput(true);
  };

  const handleUrlConfirm = () => {
      if (url.trim()) {
          const type = inputType === 'youtube' ? 'youtube' : 'url';
          if (onSelect) {
              onSelect({ uri: url.trim(), name: url.trim() }, type);
          } else if (onSelectOption) {
               onSelectOption(inputType, { url: url.trim(), type: inputType });
          }
          setUrl('');
          setShowUrlInput(false);
      }
  };

  const handleFileSelect = async (type: 'file' | 'audio') => {
      const results = await pickDocument();
      if (results && results.length > 0) {
          const file = results[0];
          if (onSelect) {
              onSelect(file, 'file');
          } else if (onSelectOption) {
               onSelectOption(type === 'file' ? 'files' : 'audio');
          }
      } else if (!results && onSelectOption) {
           onSelectOption(type === 'file' ? 'files' : 'audio');
      }
  };

  const handleImageSelect = async () => {
      const results = await pickImage();
      if (results && results.length > 0) {
          const file = results[0]; // Take first
          // Treat as 'file' for generic upload, or 'image' if specific handling needed
          // The backend treats images as files basically, but frontend might want to know it's image source
          if (onSelect) {
              onSelect(file, 'image');
          }
      }
  };

  const handleCameraSelect = async () => {
      const results = await takePhoto();
      if (results && results.length > 0) {
          const file = results[0];
          if (onSelect) {
              onSelect(file, 'camera'); // Pass as camera type to distinguish if needed, or just file
          }
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

  const getInputTitle = () => {
      return inputType === 'youtube' ? 'Adicionar Link do YouTube' : 'Adicionar Link do Site';
  };

  const getInputPlaceholder = () => {
      return inputType === 'youtube' ? 'Cole a URL do vídeo...' : 'Cole a URL do site...';
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
        className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-space-light border-t border-gray-200 dark:border-white/10 rounded-t-[32px] z-50 pb-8 overflow-hidden shadow-2xl`}
      >
        {/* Header Handle */}
        <View className="items-center pt-3 pb-2">
            <View className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full" />
        </View>

        {showUrlInput ? (
            /* URL Input View (Generic) */
            <Animated.View entering={FadeIn} className="px-6 py-6 min-h-[250px]">
                 <View className="flex-row items-center justify-between mb-4">
                     <Text className={`${themeClasses.textPrimary} text-lg font-bold`}>{getInputTitle()}</Text>
                     <Pressable onPress={handleUrlCancel} className={`p-2 rounded-full ${themeClasses.softSurface}`}>
                         <X color="#94a3b8" size={20} />
                     </Pressable>
                 </View>

                 <View className={`flex-row items-center px-4 py-3 mb-6 ${themeClasses.input}`}>
                     <Link color="#94a3b8" size={20} className="mr-3" />
                     <TextInput
                        placeholder={getInputPlaceholder()}
                        placeholderTextColor="#94a3b8"
                        value={url}
                        onChangeText={setUrl}
                        className={`flex-1 ${themeClasses.textPrimary} text-base`}
                        autoFocus
                        autoCapitalize="none"
                        keyboardType="url"
                     />
                 </View>

                 <Pressable
                    onPress={handleUrlConfirm}
                    className={`w-full py-4 rounded-xl items-center ${url.trim() ? 'bg-cosmic-purple' : 'bg-gray-100 dark:bg-white/10'}`}
                    disabled={!url.trim()}
                 >
                     <Text className={`font-bold text-base ${url.trim() ? 'text-white' : 'text-gray-500'}`}>Confirmar Link</Text>
                 </Pressable>
            </Animated.View>
        ) : (
            /* Standard Grid View */
            <>
                <View className="px-6 py-6">
                    <Text className={`${themeClasses.textSecondary} text-sm font-medium mb-4 ml-1`}>Adicionar ao Chat</Text>
                    <View className="flex-row flex-wrap justify-between gap-y-4">
                        <MediaButton
                            icon={FileText}
                            label="Arquivos"
                            color="#60a5fa"
                            onPress={() => handleFileSelect('file')}
                        />
                        <MediaButton
                            icon={ImageIcon}
                            label="Galeria"
                            color="#c084fc"
                            onPress={handleImageSelect}
                        />
                        <MediaButton
                            icon={Camera}
                            label="Câmera"
                            color="#fbbf24"
                            onPress={handleCameraSelect}
                        />
                        <MediaButton
                            icon={Globe}
                            label="Site"
                            color="#34d399"
                            onPress={() => handleUrlSelect('website')}
                        />
                        <MediaButton
                            icon={Youtube}
                            label="YouTube"
                            color="#f87171"
                            onPress={() => handleUrlSelect('youtube')}
                        />
                        <MediaButton
                            icon={Music}
                            label="Áudio"
                            color="#f472b6"
                            onPress={() => handleFileSelect('audio')}
                        />
                    </View>
                </View>

                {/* Divider - Hidden for now */}
                {false && <View className={`h-[1px] bg-gray-200 dark:bg-white/5 mx-6 mb-4`} />}

                {/* Model Footer - Hidden for now */}
                {false && (
                <View className="px-6 pb-2 z-50">
                    <View className="flex-row justify-between items-center">
                        <Text className={`${themeClasses.textSecondary} font-medium`}>Modelo</Text>

                        <Pressable
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setIsModelListOpen(!isModelListOpen);
                            }}
                            className={`flex-row items-center px-4 py-2 rounded-full ${themeClasses.softSurface}`}
                        >
                            <Text className={`${themeClasses.textPrimary} font-bold mr-2`}>{selectedModel.name}</Text>
                            {isModelListOpen ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronUp size={16} color="#94a3b8" />}
                        </Pressable>
                    </View>

                    {/* Model Popover List */}
                    {isModelListOpen && (
                        <View className={`absolute bottom-[60px] right-6 w-[200px] bg-white dark:bg-space-light border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden`}>
                            {MODELS.map((model, index) => (
                                <Pressable
                                    key={model.id}
                                    onPress={() => {
                                        setSelectedModel(model);
                                        setIsModelListOpen(false);
                                    }}
                                    className={`p-4 flex-row items-center justify-between ${index !== MODELS.length - 1 ? 'border-b border-gray-200 dark:border-white/5' : ''} active:bg-gray-50 dark:active:bg-white/5`}
                                >
                                    <Text className={`text-base ${selectedModel.id === model.id ? 'text-cosmic-purple font-bold' : themeClasses.textPrimary}`}>
                                        {model.name}
                                    </Text>
                                    {selectedModel.id === model.id && <View className="w-2 h-2 rounded-full bg-cosmic-purple" />}
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>
                )}
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
        className={`w-[48%] aspect-[1.4] ${themeClasses.softSurface} items-center justify-center space-y-3 ${themeClasses.press}`}
    >
        <View className="p-3 rounded-full bg-white/50 dark:bg-white/5">
            <Icon size={28} color={color} />
        </View>
        <Text className={`${themeClasses.textPrimary} font-medium`}>{label}</Text>
    </Pressable>
);
