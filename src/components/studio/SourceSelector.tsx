import { Check, Database, FileText, Search, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { studioService } from '../../services/studioService';
import { ContextSource } from '../../types/studio';

interface SourceSelectorProps {
    visible: boolean;
    onClose: () => void;
    chatId: string;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({
    visible,
    onClose,
    chatId,
    selectedIds,
    onSelectionChange
}) => {
    const [sources, setSources] = useState<ContextSource[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (visible) {
            loadSources();
        }
    }, [visible]);

    const loadSources = async () => {
        setLoading(true);
        try {
            const data = await studioService.getSources(chatId);
            setSources(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(sid => sid !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const filteredSources = useMemo(() => {
        if (!searchQuery) return sources;
        return sources.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [sources, searchQuery]);

    const renderItem = ({ item }: { item: ContextSource }) => {
        const isSelected = selectedIds.includes(item.id);
        const Icon = item.type === 'kb' ? Database : FileText;

        return (
            <Pressable
                onPress={() => toggleSelection(item.id)}
                className={`flex-row items-center p-4 mb-2 rounded-xl border ${isSelected ? 'bg-cosmic-purple/20 border-cosmic-purple' : 'bg-white/5 border-white/10'
                    }`}
            >
                <View className={`p-2 rounded-full mr-3 ${isSelected ? 'bg-cosmic-purple' : 'bg-white/10'}`}>
                    <Icon size={20} color={isSelected ? '#fff' : '#94a3b8'} />
                </View>
                <View className="flex-1">
                    <Text className="text-starlight font-medium text-sm" numberOfLines={1}>{item.name}</Text>
                    <Text className="text-gray-500 text-xs capitalize">{item.type === 'kb' ? 'Knowledge Base' : 'Arquivo'}</Text>
                </View>
                {isSelected && (
                    <View className="ml-2">
                        <Check size={20} color="#818cf8" />
                    </View>
                )}
            </Pressable>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1 bg-space-dark">
                <View className="flex-row items-center justify-between px-4 py-4 border-b border-white/10">
                    <Text className="text-starlight text-lg font-bold">Selecionar Fontes</Text>
                    <Pressable onPress={onClose} className="p-2 bg-white/10 rounded-full">
                        <X size={20} color="#fff" />
                    </Pressable>
                </View>

                <View className="px-4 py-2">
                    <View className="flex-row items-center bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                        <Search size={18} color="#94a3b8" />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Buscar arquivos..."
                            placeholderTextColor="#64748b"
                            className="flex-1 ml-2 text-starlight"
                        />
                    </View>
                </View>

                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator color="#818cf8" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredSources}
                        keyExtractor={item => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: 16 }}
                        ListEmptyComponent={
                            <Text className="text-gray-500 text-center mt-10">Nenhuma fonte encontrada.</Text>
                        }
                    />
                )}

                <View className="p-4 border-t border-white/10">
                    <Pressable
                        onPress={onClose}
                        className="bg-cosmic-purple py-3 rounded-xl items-center"
                    >
                        <Text className="text-white font-bold">Confirmar ({selectedIds.length})</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </Modal>
    );
};
