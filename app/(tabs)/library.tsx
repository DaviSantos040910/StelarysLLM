import { useRouter } from 'expo-router';
import { Plus, Search, Layers } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { libraryService } from '../../src/services/libraryService';
import { StudySpace } from '../../src/types/studio';
import { SpaceCard } from '../../src/components/library/SpaceCard';
import { CreateSpaceModal } from '../../src/components/library/CreateSpaceModal';

export default function LibraryScreen() {
    const router = useRouter();
    const [spaces, setSpaces] = useState<StudySpace[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalVisible, setCreateModalVisible] = useState(false);

    const loadSpaces = async () => {
        try {
            const data = await libraryService.getSpaces();
            setSpaces(data);
        } catch (error) {
            console.error('Failed to load spaces:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadSpaces();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadSpaces();
    };

    const filteredSpaces = spaces.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateSpace = async (data: { title: string; description: string }) => {
        try {
            const newSpace = await libraryService.createSpace(data);
            setSpaces([newSpace, ...spaces]);
            setCreateModalVisible(false);
            router.push(`/library/${newSpace.id}`);
        } catch (error) {
            console.error(error);
            alert("Erro ao criar espaço.");
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-space-dark" edges={['top']}>
            <View className="px-6 py-4">
                <Text className="text-starlight text-3xl font-bold mb-1">Biblioteca</Text>
                <Text className="text-gray-400 text-base">Seus espaços de estudo</Text>
            </View>

            {/* Search */}
            <View className="px-6 mb-6">
                <View className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                    <Search size={20} color="#94a3b8" />
                    <TextInput
                        className="flex-1 ml-3 text-starlight text-base"
                        placeholder="Buscar espaços..."
                        placeholderTextColor="#64748b"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {/* Content */}
            {loading && !refreshing ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="#818cf8" size="large" />
                </View>
            ) : (
                <FlatList
                    data={filteredSpaces}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <SpaceCard space={item} onPress={() => router.push(`/library/${item.id}`)} />
                    )}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
                    ListEmptyComponent={
                        <View className="items-center mt-20 opacity-50">
                            <Layers size={64} color="#94a3b8" />
                            <Text className="text-gray-400 mt-4 text-center">Nenhum espaço encontrado.</Text>
                            <Text className="text-gray-600 text-sm mt-2 text-center">Crie um novo para começar.</Text>
                        </View>
                    }
                />
            )}

            {/* FAB */}
            <Pressable
                onPress={() => setCreateModalVisible(true)}
                className="absolute bottom-8 right-6 w-14 h-14 bg-cosmic-purple rounded-full items-center justify-center shadow-lg shadow-indigo-500/50"
            >
                <Plus color="#fff" size={28} />
            </Pressable>

            <CreateSpaceModal
                visible={isCreateModalVisible}
                onClose={() => setCreateModalVisible(false)}
                onSubmit={handleCreateSpace}
            />
        </SafeAreaView>
    );
}
