import { CheckCircle2, Circle, FileText, Layers, Link as LinkIcon, Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { chatService } from '../../services/chatService';
import { libraryService } from '../../services/libraryService';
import { ContextSource } from '../../types/studio';

interface SourceSelectorProps {
    onClose: () => void;
    onSelectionChange: (ids: string[]) => void;
    selectedIds: string[];
    chatId?: string; // If provided, fetches chat sources. Else fetches global library sources.
    mode?: 'chat' | 'global';
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({
    onClose,
    onSelectionChange,
    selectedIds,
    chatId,
    mode = 'chat'
}) => {
    const [sources, setSources] = useState<ContextSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadSources();
    }, []);

    const loadSources = async () => {
        setLoading(true);
        try {
            let data: any[] = [];
            if (chatId) {
                // Fetch context sources for this specific chat
                // Note: We need an endpoint that returns all sources for a chat.
                // Assuming chatService has a method or we use a general one.
                // If specific endpoint doesn't exist, we might need to rely on what we have.
                // For now, let's assume we can fetch library sources if chat sources aren't directly available in this component's context.
                // Ideally: await chatService.getChatSources(chatId);

                // FALLBACK: Fetch from libraryService which might return all user sources.
                // Or if we want strict chat context, we need to pass them in.
                // Given the context, let's fetch global sources for now or specific chat sources if endpoint exists.

                // Using libraryService.getSources() as a general pool.
                // In a real scenario, this should likely be `api/v1/chats/{id}/context-sources/`
                 const contextSources = await chatService.getChatSources(chatId);
                 data = contextSources.map((s: any) => ({
                     id: s.id.toString(),
                     name: s.title || s.name,
                     type: s.source_type === 'YOUTUBE' || s.source_type === 'URL' ? 'kb' : 'file'
                 }));
            } else {
                 const libSources = await libraryService.getSources();
                 data = libSources.map(s => ({
                     id: s.id.toString(),
                     name: s.title,
                     type: s.source_type === 'YOUTUBE' || s.source_type === 'URL' ? 'kb' : 'file'
                 }));
            }
            setSources(data);
        } catch (error) {
            console.error("Failed to load sources", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(s => s !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const filteredSources = sources.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getIcon = (type: string) => {
        return type === 'kb' ? <LinkIcon size={20} color="#fbbf24" /> : <FileText size={20} color="#818cf8" />;
    };

    return (
        <View className="bg-space-light rounded-t-3xl border-t border-white/10 p-6 pb-10 h-[90%] w-full">

            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
                <View>
                    <Text className="text-starlight text-xl font-bold">Selecionar Fontes</Text>
                    <Text className="text-gray-400 text-sm">Escolha o conteúdo para o artefato</Text>
                </View>
                <Pressable onPress={onClose} className="p-2 bg-white/5 rounded-full">
                    <X size={24} color="#94a3b8" />
                </Pressable>
            </View>

            {/* Search */}
            <View className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10 mb-4">
                <Search size={18} color="#94a3b8" />
                <TextInput
                    className="flex-1 ml-3 text-starlight"
                    placeholder="Buscar arquivos..."
                    placeholderTextColor="#64748b"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* List */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="#818cf8" />
                </View>
            ) : (
                <FlatList
                    data={filteredSources}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={
                        <Text className="text-gray-500 text-center mt-10">Nenhuma fonte encontrada.</Text>
                    }
                    renderItem={({ item }) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                            <Pressable
                                onPress={() => toggleSelection(item.id)}
                                className={`flex-row items-center justify-between p-4 rounded-xl mb-2 border ${
                                    isSelected ? 'bg-indigo-500/10 border-indigo-500' : 'bg-white/5 border-white/5'
                                }`}
                            >
                                <View className="flex-row items-center flex-1 mr-4">
                                    <View className={`p-2 rounded-lg mr-3 ${isSelected ? 'bg-indigo-500/20' : 'bg-white/10'}`}>
                                        {getIcon(item.type)}
                                    </View>
                                    <Text className={`font-medium text-base flex-1 ${isSelected ? 'text-white' : 'text-gray-300'}`} numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                </View>

                                {isSelected ? (
                                    <CheckCircle2 size={24} color="#818cf8" />
                                ) : (
                                    <Circle size={24} color="#475569" />
                                )}
                            </Pressable>
                        );
                    }}
                />
            )}

            {/* Footer Action */}
            <Pressable
                onPress={onClose}
                className="py-4 bg-cosmic-purple rounded-2xl items-center shadow-lg shadow-indigo-500/30 mt-4"
            >
                <Text className="text-white font-bold text-lg">Confirmar Seleção ({selectedIds.length})</Text>
            </Pressable>
        </View>
    );
};
