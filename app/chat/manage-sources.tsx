import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, FileText, Link as LinkIcon, Plus, Trash2, Youtube } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttachmentSheet } from '../../src/components/chat/AttachmentSheet';
import { chatService } from '../../src/services/chatService';
import { ChatSource } from '../../src/types/chat';

export default function ManageSourcesScreen() {
    const router = useRouter();
    const { chatId } = useLocalSearchParams<{ chatId: string }>();
    const [sources, setSources] = useState<ChatSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSheetVisible, setSheetVisible] = useState(false);

    useEffect(() => {
        loadSources();
    }, [chatId]);

    const loadSources = async () => {
        try {
            setLoading(true);
            const data = await chatService.getChatSources(chatId);
            setSources(data.map(s => ({ ...s, status: 'processed' })));
        } catch (error) {
            console.error('Failed to load sources:', error);
            Alert.alert('Erro', 'Não foi possível carregar as fontes.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (sourceId: number) => {
        Alert.alert(
            'Remover Fonte',
            'Tem certeza que deseja remover esta fonte do chat?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Remover',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await chatService.removeChatSource(chatId, sourceId);
                            setSources(prev => prev.filter(s => s.id !== sourceId));
                        } catch (error) {
                            Alert.alert('Erro', 'Falha ao remover fonte.');
                        }
                    }
                }
            ]
        );
    };

    const handleAddSource = async (fileOrUrl: any, type: 'file' | 'url' | 'youtube' | 'image' | 'camera') => {
        setSheetVisible(false);
        Alert.alert("Adicionando Fonte", "Sua fonte está sendo processada.");

        // Create temporary source for optimistic UI
        const tempId = Date.now();
        // Map 'image' and 'camera' to 'FILE' since they are file uploads
        const backendType = type === 'youtube' ? 'YOUTUBE' : type === 'url' ? 'URL' : 'FILE';
        const tempTitle = fileOrUrl.name || fileOrUrl.uri || "Nova Fonte";

        const tempSource: ChatSource = {
            id: tempId,
            title: tempTitle,
            source_type: backendType,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        setSources(prev => [tempSource, ...prev]);

        try {
            const newSource = await chatService.addChatSource(chatId, fileOrUrl, backendType);

            // Replace temp source with real one
            setSources(prev => prev.map(s =>
                s.id === tempId ? { ...newSource, status: 'processed' } : s
            ));

        } catch (error) {
            console.error(error);
            // Mark as error
            setSources(prev => prev.map(s =>
                s.id === tempId ? { ...s, status: 'error' } : s
            ));
            Alert.alert("Erro", "Falha ao processar a fonte.");
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'YOUTUBE': return <Youtube color="#ef4444" size={24} />;
            case 'URL': return <LinkIcon color="#3b82f6" size={24} />;
            default: return <FileText color="#fbbf24" size={24} />;
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-space-dark" edges={['top']}>
            <View className="px-4 py-4 flex-row items-center border-b border-white/10 mb-2">
                <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-white/10">
                    <ArrowLeft color="#fff" size={24} />
                </Pressable>
                <Text className="text-starlight text-xl font-bold ml-2">Gerenciar Fontes</Text>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="#818cf8" size="large" />
                </View>
            ) : (
                <FlatList
                    data={sources}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View className="items-center mt-20 opacity-50">
                            <FileText size={48} color="#94a3b8" />
                            <Text className="text-gray-400 mt-4 text-center">Nenhuma fonte ativa.</Text>
                            <Text className="text-gray-600 text-sm text-center mt-1">Adicione arquivos ou links para dar contexto à IA.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View className="flex-row items-center bg-space-light p-4 rounded-xl mb-3 border border-white/5">
                            <View className="mr-4 bg-white/5 p-2 rounded-lg">
                                {getIcon(item.source_type || '')}
                            </View>
                            <View className="flex-1">
                                <Text className="text-starlight font-bold" numberOfLines={1}>{item.title}</Text>
                                <View className="flex-row items-center mt-1">
                                    <Text className="text-gray-500 text-xs mr-2">{item.source_type}</Text>

                                    {/* Status Indicator */}
                                    {item.status === 'pending' && (
                                        <View className="flex-row items-center">
                                            <ActivityIndicator size="small" color="#818cf8" style={{ transform: [{ scale: 0.7 }] }} />
                                            <Text className="text-indigo-400 text-xs ml-1">Processando...</Text>
                                        </View>
                                    )}
                                    {item.status === 'error' && (
                                        <View className="flex-row items-center">
                                            <AlertTriangle size={12} color="#ef4444" />
                                            <Text className="text-red-400 text-xs ml-1">Erro</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {item.status !== 'pending' && (
                                <Pressable onPress={() => handleDelete(item.id)} className="p-2 bg-red-500/10 rounded-lg">
                                    <Trash2 size={20} color="#f87171" />
                                </Pressable>
                            )}
                        </View>
                    )}
                />
            )}

            <View className="absolute bottom-6 right-6">
                <Pressable
                    onPress={() => setSheetVisible(true)}
                    className="bg-cosmic-purple w-14 h-14 rounded-full items-center justify-center shadow-lg shadow-indigo-500/30 active:opacity-90"
                >
                    <Plus color="#fff" size={28} />
                </Pressable>
            </View>

            <AttachmentSheet
                visible={isSheetVisible}
                onClose={() => setSheetVisible(false)}
                onSelect={(file, type) => handleAddSource(file, type)}
            />
        </SafeAreaView>
    );
}
