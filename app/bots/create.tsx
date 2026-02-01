import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Camera, Globe, Sparkles, FolderOpen, Layers, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAttachmentPicker } from '../../src/hooks/useAttachmentPicker';
import { botService } from '../../src/services/botService';
import { exploreService, Category } from '../../src/services/exploreService';
import { libraryService } from '../../src/services/libraryService';
import { StudySpace } from '../../src/types/studio';

export default function CreateBotScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const botId = params.botId as string;
    const isEditMode = !!botId;

    const { pickImage } = useAttachmentPicker();

    // Data State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [prompt, setPrompt] = useState('');
    const [allowWebSearch, setAllowWebSearch] = useState(false);
    const [strictContext, setStrictContext] = useState(false);

    // Selectors State
    const [avatar, setAvatar] = useState<any>(null);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);

    // Available Options
    const [categories, setCategories] = useState<Category[]>([]);
    const [spaces, setSpaces] = useState<StudySpace[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadOptions();
        if (isEditMode) {
            loadBotData();
        }
    }, [botId]);

    const loadOptions = async () => {
        try {
            const [cats, userSpaces] = await Promise.all([
                exploreService.getCategories(),
                libraryService.getSpaces()
            ]);
            setCategories(cats);
            setSpaces(userSpaces);
        } catch (error) {
            console.error(error);
        }
    };

    const loadBotData = async () => {
        setIsLoading(true);
        try {
            const bot = await botService.getBot(botId);
            setName(bot.name);
            setDescription(bot.description || '');
            setPrompt(bot.prompt || '');
            setAllowWebSearch(bot.allow_web_search);
            setStrictContext(bot.strict_context || false);

            if (bot.avatar_url) setAvatar({ uri: bot.avatar_url });

            if (bot.categories) {
                setSelectedCategories(bot.categories.map((c: any) => c.id));
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Falha ao carregar dados do tutor.");
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    const handlePickAvatar = async () => {
        const result = await pickImage(false); // Single selection for avatar
        if (result && result[0]) setAvatar(result[0]);
    };

    const toggleCategory = (id: string) => {
        if (selectedCategories.includes(id)) {
            setSelectedCategories(prev => prev.filter(c => c !== id));
        } else {
            if (selectedCategories.length >= 3) {
                Alert.alert("Limite", "Você pode selecionar no máximo 3 categorias.");
                return;
            }
            setSelectedCategories(prev => [...prev, id]);
        }
    };

    const handleDelete = async () => {
        Alert.alert(
            "Excluir Tutor",
            "Tem certeza que deseja excluir este tutor? Todas as conversas associadas serão perdidas.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        setIsSubmitting(true);
                        try {
                            await botService.deleteBot(botId);
                            Alert.alert("Sucesso", "Tutor excluído com sucesso.");
                            router.replace('/(tabs)/');
                        } catch (error) {
                            console.error(error);
                            Alert.alert("Erro", "Falha ao excluir o tutor.");
                        } finally {
                            setIsSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSubmit = async () => {
        if (!name.trim() || !prompt.trim()) {
            Alert.alert("Campos obrigatórios", "Por favor, preencha o nome e as instruções do tutor.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (isEditMode) {
                await botService.updateBot(botId, {
                    name,
                    description,
                    prompt,
                    allow_web_search: allowWebSearch,
                    strict_context: strictContext,
                    publicity: 'Public',
                    avatar: avatar?.uri?.startsWith('http') ? undefined : avatar, // Only send if changed (local uri)
                    category_ids: selectedCategories,
                    study_space_ids: selectedSpaceId ? [selectedSpaceId] : undefined
                });
                Alert.alert("Sucesso", "Tutor atualizado com sucesso!");
                router.back(); // Go back to chat
            } else {
                const newBot = await botService.createBot({
                    name,
                    description,
                    prompt,
                    allow_web_search: allowWebSearch,
                    strict_context: strictContext,
                    publicity: 'Public',
                    avatar,
                    category_ids: selectedCategories,
                    study_space_ids: selectedSpaceId ? [selectedSpaceId] : undefined
                });

                if (!newBot || !newBot.id) {
                    throw new Error("Failed to create bot: No ID returned.");
                }

                const bootstrap = await botService.getChatBootstrap(newBot.id);

                router.replace({
                    pathname: `/chat/${bootstrap.conversationId}`,
                    params: {
                        botId: newBot.id,
                        botName: newBot.name,
                        botAvatar: newBot.avatar_url
                    }
                });
            }

        } catch (error: any) {
            console.error(error);
            const msg = error.message || "Falha ao salvar o tutor.";
            Alert.alert("Erro", msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-space-dark items-center justify-center">
                <ActivityIndicator size="large" color="#818cf8" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-space-dark" edges={['top']}>
            {/* Header */}
            <View className="px-4 py-4 flex-row items-center justify-between border-b border-white/10 bg-space-dark z-10">
                <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-white/10">
                    <ArrowLeft color="#fff" size={24} />
                </Pressable>
                <Text className="text-starlight text-xl font-bold">{isEditMode ? 'Editar Tutor' : 'Criar Novo Tutor'}</Text>
                <Pressable
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    className={`px-4 py-2 rounded-full ${isSubmitting ? 'bg-gray-700' : 'bg-cosmic-purple'}`}
                >
                    {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-bold">{isEditMode ? 'Salvar' : 'Criar'}</Text>}
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
                {/* 1. Identity Section (Avatar Only) */}
                <View className="items-center mb-6 mt-6">
                    {/* Avatar */}
                    <Pressable
                        onPress={handlePickAvatar}
                        className="w-28 h-28 rounded-full bg-space-light border-4 border-space-dark items-center justify-center overflow-hidden z-10"
                    >
                        {({ pressed }) => (
                            <>
                                {avatar ? (
                                    <Image source={{ uri: avatar.uri }} className="w-full h-full" />
                                ) : (
                                    <View className="w-full h-full items-center justify-center bg-white/10">
                                        <Sparkles size={32} color="#94a3b8" />
                                    </View>
                                )}
                                <View
                                    className="absolute inset-0 bg-black/30 items-center justify-center"
                                    style={{ opacity: pressed ? 1 : 0 }}
                                    pointerEvents="none"
                                >
                                    <Camera size={24} color="#fff" />
                                </View>
                            </>
                        )}
                    </Pressable>
                    <Text className="text-gray-400 text-xs mt-2">Toque para alterar a imagem</Text>
                </View>

                {/* Form Content */}
                <View className="px-6 space-y-8">
                    {/* Basic Info */}
                    <View>
                        <Text className="text-gray-400 font-bold mb-3">Nome do Tutor</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Ex: Professor de História"
                            placeholderTextColor="#64748b"
                            className="bg-white/5 text-starlight p-4 rounded-xl border border-white/10 text-lg font-bold"
                        />
                    </View>

                    <View>
                        <Text className="text-gray-400 font-bold mb-3">Descrição (Opcional)</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Breve descrição sobre o que ele ensina..."
                            placeholderTextColor="#64748b"
                            className="bg-white/5 text-starlight p-4 rounded-xl border border-white/10"
                        />
                    </View>

                    {/* Intelligence */}
                    <View>
                        <View className="flex-row items-center mb-4">
                            <Sparkles size={16} color="#fbbf24" className="mr-2" />
                            <Text className="text-starlight font-bold text-lg">Inteligência</Text>
                        </View>

                        <Text className="text-gray-400 font-bold mb-3">Instruções do Sistema (Prompt)</Text>
                        <TextInput
                            value={prompt}
                            onChangeText={setPrompt}
                            placeholder="Como o tutor deve se comportar? O que ele sabe?"
                            placeholderTextColor="#64748b"
                            multiline
                            textAlignVertical="top"
                            className="bg-white/5 text-starlight p-4 rounded-xl border border-white/10 min-h-[120px]"
                        />

                        <View className="flex-row items-center justify-between mt-4 bg-white/5 p-4 rounded-xl border border-white/10">
                            <View className="flex-row items-center flex-1 mr-4">
                                <Globe size={20} color="#3b82f6" />
                                <View className="ml-3">
                                    <Text className="text-starlight font-bold">Acesso à Internet</Text>
                                    <Text className="text-gray-500 text-xs">Permitir pesquisas no Google em tempo real</Text>
                                </View>
                            </View>
                            <Switch
                                value={allowWebSearch}
                                onValueChange={(val) => {
                                    setAllowWebSearch(val);
                                    if (val) setStrictContext(false);
                                }}
                                trackColor={{ false: "#334155", true: "#3b82f6" }}
                                thumbColor="#ffffff"
                            />
                        </View>

                        <View className="flex-row items-center justify-between mt-4 bg-white/5 p-4 rounded-xl border border-white/10">
                            <View className="flex-row items-center flex-1 mr-4">
                                <FolderOpen size={20} color="#eab308" />
                                <View className="ml-3">
                                    <Text className="text-starlight font-bold">Apenas Fontes</Text>
                                    <Text className="text-gray-500 text-xs">Responder estritamente com base nos arquivos enviados</Text>
                                </View>
                            </View>
                            <Switch
                                value={strictContext}
                                onValueChange={(val) => {
                                    setStrictContext(val);
                                    if (val) setAllowWebSearch(false);
                                }}
                                trackColor={{ false: "#334155", true: "#eab308" }}
                                thumbColor="#ffffff"
                            />
                        </View>
                    </View>

                    {/* Organization */}
                    <View>
                        <View className="flex-row items-center mb-4">
                            <Layers size={16} color="#34d399" className="mr-2" />
                            <Text className="text-starlight font-bold text-lg">Organização</Text>
                        </View>

                        <Text className="text-gray-400 font-bold mb-4">Categorias (Máx 3)</Text>
                        <View className="flex-row flex-wrap gap-2 mb-8">
                            {categories.map(cat => {
                                const isSelected = selectedCategories.includes(cat.id);
                                return (
                                    <Pressable
                                        key={cat.id}
                                        onPress={() => toggleCategory(cat.id)}
                                        className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-white/20 border-white' : 'bg-white/5 border-white/10'}`}
                                    >
                                        <Text className={`${isSelected ? 'text-white font-bold' : 'text-gray-400'}`}>{cat.name}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text className="text-gray-400 font-bold mb-4">Vincular Espaço de Estudo (Opcional)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Pressable
                                onPress={() => setSelectedSpaceId(null)}
                                className={`mr-4 p-4 rounded-xl border w-[140px] h-[100px] justify-between ${selectedSpaceId === null ? 'bg-white/10 border-white' : 'bg-white/5 border-white/10'}`}
                            >
                                <FolderOpen size={24} color="#94a3b8" />
                                <Text className="text-gray-400 font-medium">Nenhum</Text>
                            </Pressable>

                            {spaces.map(space => {
                                const isSelected = selectedSpaceId === space.id;
                                return (
                                    <Pressable
                                        key={space.id}
                                        onPress={() => setSelectedSpaceId(space.id)}
                                        className={`mr-4 p-4 rounded-xl border w-[140px] h-[100px] justify-between ${isSelected ? 'bg-white/10 border-white' : 'bg-white/5 border-white/10'}`}
                                    >
                                        <FolderOpen size={24} color={isSelected ? '#818cf8' : "#94a3b8"} />
                                        <Text className={`font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`} numberOfLines={2}>
                                            {space.title}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Delete Button (Only in Edit Mode) */}
                    {isEditMode && (
                        <Pressable
                            onPress={handleDelete}
                            className="flex-row items-center justify-center p-4 bg-red-500/10 rounded-xl border border-red-500/30 mt-8 mb-4"
                        >
                            <Trash2 size={20} color="#ef4444" className="mr-2" />
                            <Text className="text-red-500 font-bold text-lg">Apagar Tutor</Text>
                        </Pressable>
                    )}

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
