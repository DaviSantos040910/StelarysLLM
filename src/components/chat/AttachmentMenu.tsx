import React, { useState } from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { Camera, Image as ImageIcon, FileText, X } from 'lucide-react-native';
import { themeClasses } from '../../theme/classes';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelectImage: () => void;
  onSelectDocument: () => void;
  onTakePhoto: () => void;
}

export const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  visible,
  onClose,
  onSelectImage,
  onSelectDocument,
  onTakePhoto,
}) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable className={`rounded-t-3xl p-6 ${themeClasses.surface}`} onPress={(e) => e.stopPropagation()}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className={`${themeClasses.textPrimary} text-xl font-bold`}>Share Content</Text>
            <Pressable onPress={onClose} className={`p-2 rounded-full ${themeClasses.softSurface}`}>
              <X color="#94a3b8" size={20} />
            </Pressable>
          </View>

          <View className="flex-col space-y-4">
             <Pressable
                className={`flex-row items-center p-4 rounded-xl ${themeClasses.softSurface} ${themeClasses.press}`}
                onPress={() => { onClose(); onTakePhoto(); }}
             >
                 <View className="p-3 bg-emerald-500/20 rounded-full mr-4">
                    <Camera color="#10b981" size={24} />
                 </View>
                 <View>
                    <Text className={`${themeClasses.textPrimary} font-bold text-lg`}>Camera</Text>
                    <Text className={themeClasses.textMuted}>Take a photo</Text>
                 </View>
             </Pressable>

             <Pressable
                className={`flex-row items-center p-4 rounded-xl ${themeClasses.softSurface} ${themeClasses.press}`}
                onPress={() => { onClose(); onSelectImage(); }}
             >
                 <View className="p-3 bg-blue-500/20 rounded-full mr-4">
                    <ImageIcon color="#3b82f6" size={24} />
                 </View>
                 <View>
                    <Text className={`${themeClasses.textPrimary} font-bold text-lg`}>Gallery</Text>
                    <Text className={themeClasses.textMuted}>Share images</Text>
                 </View>
             </Pressable>

             <Pressable
                className={`flex-row items-center p-4 rounded-xl ${themeClasses.softSurface} ${themeClasses.press}`}
                onPress={() => { onClose(); onSelectDocument(); }}
             >
                 <View className="p-3 bg-orange-500/20 rounded-full mr-4">
                    <FileText color="#f97316" size={24} />
                 </View>
                 <View>
                    <Text className={`${themeClasses.textPrimary} font-bold text-lg`}>Document</Text>
                    <Text className={themeClasses.textMuted}>Share files</Text>
                 </View>
             </Pressable>
          </View>
          <View className="h-8" />
        </Pressable>
      </Pressable>
    </Modal>
  );
};
