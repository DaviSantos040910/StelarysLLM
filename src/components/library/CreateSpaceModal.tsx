import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: { title: string; description: string }) => Promise<void>;
}

export const CreateSpaceModal: React.FC<Props> = ({ visible, onClose, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setLoading(true);
        try {
            await onSubmit({ title, description });
            setTitle('');
            setDescription('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/70 justify-center items-center p-6">
                <View className="w-full bg-space-light rounded-2xl border border-white/10 p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-starlight text-xl font-bold">Novo Espaço</Text>
                        <Pressable onPress={onClose} className="p-2 bg-white/5 rounded-full">
                            <X size={20} color="#94a3b8" />
                        </Pressable>
                    </View>

                    <Text className="text-gray-400 font-medium mb-2">Nome do Espaço</Text>
                    <TextInput
                        className="bg-white/5 text-white p-4 rounded-xl border border-white/10 mb-4"
                        placeholder="Ex: Biologia Molecular"
                        placeholderTextColor="#64748b"
                        value={title}
                        onChangeText={setTitle}
                        autoFocus
                    />

                    <Text className="text-gray-400 font-medium mb-2">Descrição (Opcional)</Text>
                    <TextInput
                        className="bg-white/5 text-white p-4 rounded-xl border border-white/10 mb-6 h-24"
                        placeholder="Notas sobre o semestre..."
                        placeholderTextColor="#64748b"
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
