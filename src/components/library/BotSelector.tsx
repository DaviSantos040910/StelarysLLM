import { Bot, Check, Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { botService } from '../../services/botService';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (botId: number) => void;
    excludeIds?: number[];
}

export const BotSelector: React.FC<Props> = ({ visible, onClose, onSelect, excludeIds = [] }) => {
    const [bots, setBots] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (visible) loadBots();
    }, [visible]);

    const loadBots = async () => {
        setLoading(true);
        try {
            const data = await botService.getBots();
            setBots(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredBots = bots.filter(b =>
        !excludeIds.includes(b.id) &&
        b.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View className="flex-1 bg-space-dark">
                <View className="px-4 py-4 flex-row justify-between items-center border-b border-white/10">
                    <Text className="text-starlight text-lg font-bold">Adicionar Tutor</Text>
                    <Pressable onPress={onClose} className="p-2 bg-white/10 rounded-full">
                        <X size={20} color="#fff" />
                    </Pressable>
                </View>

                <View className="p-4">
                    <View className="bg-white/5 flex-row items-center px-4 py-3 rounded-xl border border-white/10">
                        <Search size={20} color="#94a3b8" />
                        <TextInput
                            className="flex-1 ml-3 text-white"
                            placeholder="Buscar tutor..."
                            placeholderTextColor="#64748b"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator color="#818cf8" size="large" className="mt-10" />
                ) : (
                    <FlatList
                        data={filteredBots}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{ padding: 16 }}
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => onSelect(item.id)}
                                className="flex-row items-center p-4 bg-white/5 rounded-xl mb-3 border border-white/5 active:bg-white/10"
                            >
                                <View className="w-10 h-10 bg-indigo-500/20 rounded-full items-center justify-center mr-3">
                                    <Bot size={20} color="#818cf8" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-starlight font-bold">{item.name}</Text>
                                    <Text className="text-gray-500 text-xs" numberOfLines={1}>{item.description}</Text>
                                </View>
                                <View className="bg-white/10 p-2 rounded-full">
                                    <Check size={16} color="#fff" />
                                </View>
                            </Pressable>
                        )}
                        ListEmptyComponent={
                            <Text className="text-gray-500 text-center mt-10">Nenhum tutor disponível.</Text>
                        }
                    />
                )}
            </View>
        </Modal>
    );
};
