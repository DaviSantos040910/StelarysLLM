import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, History, MessageSquare } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chatService } from '../../src/services/chatService';
import { ChatListItem } from '../../src/types/chat';

export default function ChatHistoryScreen() {
    const router = useRouter();
    const { botId, currentChatId } = useLocalSearchParams<{ botId: string; currentChatId?: string }>();
    const [chats, setChats] = useState<ChatListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRestoring, setIsRestoring] = useState(false);

    useEffect(() => {
        loadHistory();
    }, [botId]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const data = await chatService.getArchivedChats(botId);
            setChats(data);
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Não foi possível carregar o histórico.');
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreChat = async (chatId: string) => {
        if (chatId === currentChatId) {
            Alert.alert("Aviso", "Esta conversa já está ativa.");
            return;
        }

        Alert.alert(
            "Retomar Conversa",
            "Deseja reativar esta conversa? A conversa atual será arquivada.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sim, retomar",
                    onPress: async () => {
                        try {
                            setIsRestoring(true);
                            await chatService.setActiveChat(chatId);
                            // Navigate back to chat screen with the restored ID
                            // Use replace to avoid stacking multiple chat screens
                            router.replace({
                                pathname: `/chat/${chatId}` as any,
                                params: { botId }
                            });
                        } catch (error) {
                            Alert.alert("Erro", "Falha ao restaurar a conversa.");
                            setIsRestoring(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-space-dark" edges={['top']}>
            <View className="px-4 py-4 flex-row items-center border-b border-white/10 mb-2">
                <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-white/10">
                    <ArrowLeft color="#fff" size={24} />
                </Pressable>
                <Text className="text-starlight text-xl font-bold ml-2">Histórico de Conversas</Text>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="#818cf8" size="large" />
                </View>
            ) : (
                <FlatList
                    data={chats}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        <View className="items-center mt-20 opacity-50">
                            <History size={48} color="#94a3b8" />
                            <Text className="text-gray-400 mt-4 text-center">Nenhuma conversa arquivada.</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const dateStr = formatDistanceToNowStrict(new Date(item.last_message_at || Date.now()), { addSuffix: true, locale: ptBR });

                        return (
                            <Pressable
                                onPress={() => handleRestoreChat(item.id)}
                                disabled={isRestoring}
                                className="bg-space-light p-4 rounded-xl mb-3 border border-white/5 active:bg-white/10 flex-row items-center justify-between"
                            >
                                <View className="flex-1 mr-4">
                                    <View className="flex-row items-center mb-1">
                                        <MessageSquare size={14} color="#818cf8" />
                                        <Text className="text-gray-400 text-xs ml-2">{dateStr}</Text>
                                    </View>
                                    <Text className="text-starlight font-bold" numberOfLines={1}>
                                        {item.last_message?.content || "Conversa sem título"}
                                    </Text>
                                    <Text className="text-gray-500 text-sm mt-1" numberOfLines={2}>
                                        {item.last_message?.content || "Toque para ver o conteúdo..."}
                                    </Text>
                                </View>
                                {isRestoring ? (
                                    <ActivityIndicator color="#818cf8" size="small" />
                                ) : (
                                    <View className="px-3 py-1 bg-white/5 rounded-lg">
                                        <Text className="text-cosmic-purple text-xs font-bold">Abrir</Text>
                                    </View>
                                )}
                            </Pressable>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}
