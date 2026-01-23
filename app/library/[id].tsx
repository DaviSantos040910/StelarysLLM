import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Bot as BotIcon, MoreVertical, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { libraryService } from '../../src/services/libraryService';
import { StudySpace } from '../../src/types/studio';
import { SourceSelector } from '../../src/components/studio/SourceSelector'; // Reused
import { BotSelector } from '../../src/components/library/BotSelector';

export default function SpaceDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [space, setSpace] = useState<StudySpace | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'SOURCES' | 'BOTS'>('SOURCES');

    // Modals
    const [isSourceSelectorVisible, setSourceSelectorVisible] = useState(false);
    const [isBotSelectorVisible, setBotSelectorVisible] = useState(false);

    const loadSpace = async () => {
        try {
            if (!id) return;
            const data = await libraryService.getSpace(parseInt(id, 10));
            setSpace(data);
        } catch (error) {
            console.error('Failed to load space details:', error);
            Alert.alert('Erro', 'Não foi possível carregar o espaço.');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadSpace();
        }, [id])
    );

    const handleAddSources = async (sourceIds: string[]) => {
        if (!space) return;
        try {
            // Add each selected source
            for (const sid of sourceIds) {
                const sIdNum = parseInt(sid, 10);
                if (!isNaN(sIdNum)) {
                    await libraryService.addSource(space.id, sIdNum);
                }
            }
            await loadSpace(); // Refresh
            setSourceSelectorVisible(false);
        } catch (e) {
            console.error(e);
            Alert.alert('Erro', 'Falha ao adicionar fontes.');
        }
    };

    const handleRemoveSource = async (sourceId: number) => {
        if (!space) return;
        try {
            await libraryService.removeSource(space.id, sourceId);
            setSpace(prev => prev ? ({
                ...prev,
                sources: prev.sources.filter(s => parseInt(s.id) !== sourceId)
            }) : null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleLinkBot = async (botId: number) => {
        if (!space) return;
        try {
            await libraryService.linkBot(space.id, botId);
            await loadSpace();
            setBotSelectorVisible(false);
        } catch (e) {
            console.error(e);
            Alert.alert('Erro', 'Falha ao vincular tutor.');
        }
    };

    const handleUnlinkBot = async (botId: number) => {
        if (!space) return;
        try {
            await libraryService.unlinkBot(space.id, botId);
            setSpace(prev => prev ? ({
                ...prev,
                bots: prev.bots.filter(b => b.id !== botId)
            }) : null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleChatWithBot = (botId: number) => {
        router.push({ pathname: '/chat/[id]', params: { id: 'new', botId: botId.toString(), spaceId: space?.id } });
    };

    if (loading || !space) {
        return (
            <View className="flex-1 bg-space-dark justify-center items-center">
                <ActivityIndicator color="#818cf8" size="large" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-space-dark" edges={['top']}>

            {/* Header */}
            <View className="px-4 py-4 flex-row items-center justify-between border-b border-white/10">
                <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-white/10">
                    <ArrowLeft color="#fff" size={24} />
                </Pressable>
                <Text className="text-starlight text-lg font-bold flex-1 ml-2" numberOfLines={1}>{space.title}</Text>
                <Pressable className="p-2 rounded-full active:bg-white/10">
                    <MoreVertical color="#fff" size={24} />
                </Pressable>
            </View>

            {/* Tabs */}
            <View className="flex-row border-b border-white/10">
                <Pressable
                    onPress={() => setActiveTab('SOURCES')}
                    className={`flex-1 py-4 items-center border-b-2 ${activeTab === 'SOURCES' ? 'border-cosmic-purple' : 'border-transparent'}`}
                >
                    <Text className={`font-bold ${activeTab === 'SOURCES' ? 'text-white' : 'text-gray-500'}`}>Fontes ({space.sources.length})</Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab('BOTS')}
                    className={`flex-1 py-4 items-center border-b-2 ${activeTab === 'BOTS' ? 'border-cosmic-purple' : 'border-transparent'}`}
                >
                    <Text className={`font-bold ${activeTab === 'BOTS' ? 'text-white' : 'text-gray-500'}`}>Tutores ({space.bots.length})</Text>
                </Pressable>
            </View>

            {/* List */}
            {activeTab === 'SOURCES' ? (
                <FlatList
                    data={space.sources}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <View className="flex-row items-center justify-between bg-white/5 p-4 rounded-xl mb-3 border border-white/5">
                            <View className="flex-row items-center flex-1">
                                <View className="bg-blue-500/20 p-2 rounded-lg mr-3">
                                    <BookOpen size={20} color="#60a5fa" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-starlight font-medium" numberOfLines={1}>{item.name}</Text>
                                    <Text className="text-gray-500 text-xs">Adicionado em {new Date().toLocaleDateString()}</Text>
                                </View>
                            </View>
                            <Pressable onPress={() => handleRemoveSource(parseInt(item.id))} className="p-2">
                                <Trash2 size={20} color="#ef4444" />
                            </Pressable>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text className="text-gray-500 text-center mt-10">Nenhuma fonte vinculada.</Text>
                    }
                />
            ) : (
                <FlatList
                    data={space.bots}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => handleChatWithBot(item.id)}
                            className="flex-row items-center justify-between bg-white/5 p-4 rounded-xl mb-3 border border-white/5 active:bg-white/10"
                        >
                            <View className="flex-row items-center flex-1">
                                <Image
                                    source={{ uri: item.avatar || 'https://via.placeholder.com/50' }}
                                    className="w-10 h-10 rounded-full mr-3 bg-gray-600"
                                />
                                <View>
                                    <Text className="text-starlight font-medium">{item.name}</Text>
                                    <Text className="text-gray-500 text-xs" numberOfLines={1}>{item.description}</Text>
                                </View>
                            </View>
                            <Pressable onPress={() => handleUnlinkBot(item.id)} className="p-2 ml-2">
                                <Trash2 size={20} color="#64748b" />
                            </Pressable>
                        </Pressable>
                    )}
                    ListEmptyComponent={
                        <Text className="text-gray-500 text-center mt-10">Nenhum tutor vinculado.</Text>
                    }
                />
            )}

            {/* FAB */}
            <Pressable
                onPress={() => activeTab === 'SOURCES' ? setSourceSelectorVisible(true) : setBotSelectorVisible(true)}
                className="absolute bottom-8 right-6 w-14 h-14 bg-cosmic-purple rounded-full items-center justify-center shadow-lg shadow-indigo-500/50"
            >
                <Plus color="#fff" size={28} />
            </Pressable>

            {/* Modals */}
            {isSourceSelectorVisible && (
                <View className="absolute inset-0 bg-black/80 z-50 justify-end">
                    <SourceSelector
                        mode="global"
                        selectedIds={space.sources.map(s => s.id)}
                        onClose={() => setSourceSelectorVisible(false)}
                        onSelectionChange={(ids) => {
                            // Hack: SourceSelector calls onSelectionChange with ALL selected IDs.
                            handleAddSources(ids);
                        }}
                    />
                </View>
            )}

            <BotSelector
                visible={isBotSelectorVisible}
                onClose={() => setBotSelectorVisible(false)}
                onSelect={handleLinkBot}
                excludeIds={space.bots.map(b => b.id)}
            />

        </SafeAreaView>
    );
}
