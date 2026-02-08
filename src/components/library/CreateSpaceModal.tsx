import { X, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { themeClasses } from '../../theme/classes';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: { title: string; description: string; coverImage?: any }) => Promise<void>;
}

export const CreateSpaceModal: React.FC<Props> = ({ visible, onClose, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0]);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setLoading(true);
        try {
            await onSubmit({ title, description, coverImage: image });
            setTitle('');
            setDescription('');
            setImage(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/70 justify-center items-center p-6">
                <View className={`w-full rounded-2xl border border-gray-200 dark:border-white/10 p-6 ${themeClasses.surface}`}>
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className={`${themeClasses.textPrimary} text-xl font-bold`}>Novo Espaço</Text>
                        <Pressable onPress={onClose} className={`p-2 rounded-full ${themeClasses.softSurface}`}>
                            <X size={20} color="#94a3b8" />
                        </Pressable>
                    </View>

                    {/* Image Picker */}
                    <Pressable
                        onPress={pickImage}
                        className={`w-full h-32 rounded-xl mb-6 items-center justify-center overflow-hidden ${themeClasses.softSurface}`}
                    >
                        {image ? (
                            <View className="w-full h-full relative">
                                <Image source={{ uri: image.uri }} className="w-full h-full" resizeMode="cover" />
                                <Pressable
                                    onPress={(e) => { e.stopPropagation(); setImage(null); }}
                                    className="absolute top-2 right-2 bg-black/50 p-2 rounded-full"
                                >
                                    <Trash2 size={16} color="#ef4444" />
                                </Pressable>
                            </View>
                        ) : (
                            <View className="items-center">
                                <ImageIcon size={32} color="#64748b" />
                                <Text className={`${themeClasses.textMuted} mt-2`}>Adicionar Capa</Text>
                            </View>
                        )}
                    </Pressable>

                    <Text className={`${themeClasses.textSecondary} font-medium mb-2`}>Nome do Espaço</Text>
                    <TextInput
                        className={`${themeClasses.input} p-4 mb-4`}
                        placeholder="Ex: Biologia Molecular"
                        placeholderTextColor="#94a3b8"
                        value={title}
                        onChangeText={setTitle}
                    />

                    <Text className={`${themeClasses.textSecondary} font-medium mb-2`}>Descrição (Opcional)</Text>
                    <TextInput
                        className={`${themeClasses.input} p-4 mb-6 h-24`}
                        placeholder="Notas sobre o semestre..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        textAlignVertical="top"
                        value={description}
                        onChangeText={setDescription}
                    />

                    <Pressable
                        onPress={handleSubmit}
                        disabled={loading || !title.trim()}
                        className={`py-4 rounded-xl items-center ${loading || !title.trim() ? 'bg-gray-700' : 'bg-cosmic-purple'}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text className="text-white font-bold text-lg">Criar Espaço</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};
