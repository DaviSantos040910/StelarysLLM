import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Camera, FolderOpen, Globe, Layers, Sparkles, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAttachmentPicker } from '../../src/hooks/useAttachmentPicker';
import { botService } from '../../src/services/botService';
import { Category, exploreService } from '../../src/services/exploreService';
import { libraryService } from '../../src/services/libraryService';
import { useChatStore } from '../../src/stores/chatStore';
import { StudySpace } from '../../src/types/studio';
import { themeClasses } from '../../src/theme/classes';

export default function CreateBotScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const botId = params.botId as string;
    const isEditMode = !!botId;

    const { pickImage } = useAttachmentPicker();
    const { updateCurrentChatBot } = useChatStore();

    // Data State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [prompt, setPrompt] = useState('');
    // const [allowWebSearch, setAllowWebSearch] = useState(false); // REMOVED: Always true
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
            // setAllowWebSearch(bot.allow_web_search); // REMOVED
            setStrictContext(bot.strict_context || false);

            const avatarUri = bot.avatarUrl || bot.avatar_url;
            if (avatarUri) setAvatar({ uri: avatarUri });

            if (bot.categories) {
                // Handle both object (from BotSerializer) and ID (from default ModelSerializer) formats
                const categoryIds = bot.categories.map((c: any) => {
                    if (c && typeof c === 'object' && c.id) return String(c.id);
                    return String(c);
                }).filter((id: string) => id && id !== 'undefined');
                setSelectedCategories(categoryIds);
            }

            if (bot.study_spaces && bot.study_spaces.length > 0) {
                // If study_spaces is list of IDs [1] or Objects [{id:1}]
                const firstSpace = bot.study_spaces[0];
                const spaceId = (typeof firstSpace === 'object' && firstSpace.id) ? firstSpace.id : firstSpace;
                setSelectedSpaceId(Number(spaceId));
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
                            router.replace('/(tabs)/' as any);
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
                // Only send avatar if it has a 'name' property (indicating a new pick)
                // Existing avatars are just { uri: ... } without name/type
                const avatarToSend = avatar?.name ? avatar : undefined;

                const updatedBot = await botService.updateBot(botId, {
                    name,
                    description,
                    prompt,
                    allow_web_search: true, // ALWAYS TRUE
                    strict_context: strictContext,
                    publicity: 'Public',
                    avatar: avatarToSend,
                    category_ids: selectedCategories,
                    study_space_ids: selectedSpaceId ? [selectedSpaceId] : undefined
                });

                // Update global chat store to reflect changes immediately in ChatScreen
                updateCurrentChatBot({
                    name: updatedBot.name,
                    description: updatedBot.description,
                    avatar_url: updatedBot.avatar_url || updatedBot.avatarUrl,
                    allow_web_search: true, // ALWAYS TRUE
                    strict_context: updatedBot.strict_context,
                    study_spaces: updatedBot.study_spaces,
                    prompt: updatedBot.prompt
                });

                Alert.alert("Sucesso", "Tutor atualizado com sucesso!");
                router.back(); // Go back to chat
            } else {
                const newBot = await botService.createBot({
                    name,
                    description,
                    prompt,
                    allow_web_search: true, // ALWAYS TRUE
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
                    pathname: `/chat/${bootstrap.conversationId}` as any,
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
            <View className={`flex-1 items-center justify-center ${themeClasses.screen}`}>
                <ActivityIndicator size="large" color="#818cf8" />
            </View>
        );
    }

    return (
        <SafeAreaView className={themeClasses.screen} edges={['top']}>
            {/* Header */}
            <View className={`px-4 py-4 flex-row items-center justify-between ${themeClasses.headerBorder} ${themeClasses.screen} z-10`}>
                <Pressable onPress={() => router.back()} className={`p-2 -ml-2 rounded-full ${themeClasses.press}`}>
                    <ArrowLeft className={themeClasses.iconPrimary} size={24} />
                </Pressable>
                <Text className={`${themeClasses.textPrimary} text-xl font-bold`}>{isEditMode ? 'Editar Tutor' : 'Criar Novo Tutor'}</Text>
                <Pressable
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    className={`min-h-[36px] items-center justify-center px-4 py-2 rounded-full ${isSubmitting ? 'bg-gray-400 dark:bg-gray-700' : 'bg-cosmic-purple'}`}
                >
                    {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-bold text-center">{isEditMode ? 'Salvar' : 'Criar'}</Text>}
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
                {/* 1. Identity Section (Avatar Only) */}
                <View className="items-center mb-6 mt-6">
                    {/* Avatar */}
                    <Pressable
                        onPress={handlePickAvatar}
                        className="w-28 h-28 rounded-full bg-white dark:bg-space-light border-4 border-gray-100 dark:border-space-dark items-center justify-center overflow-hidden z-10"
                    >
                        {({ pressed }) => (
                            <>
                                {avatar ? (
                                    <Image source={{ uri: avatar.uri }} className="w-full h-full" />
                                ) : (
                                    <View className="w-full h-full items-center justify-center bg-gray-50 dark:bg-white/10">
                                        <Sparkles size={32} className={themeClasses.iconSecondary} />
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
                    <Text className={`${themeClasses.textMuted} text-xs mt-2`}>Toque para alterar a imagem</Text>
                </View>

                {/* Form Content */}
                <View className="px-6 space-y-8">
                    {/* Basic Info */}
                    <View>
                        <Text className={`${themeClasses.textSecondary} font-bold mb-3`}>Nome do Tutor</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Ex: Professor de História"
                            placeholderTextColor="#94a3b8"
                            className={`${themeClasses.input} text-lg font-bold p-4`}
                        />
                    </View>

                    <View>
                        <Text className={`${themeClasses.textSecondary} font-bold mb-3`}>Descrição (Opcional)</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Breve descrição sobre o que ele ensina..."
                            placeholderTextColor="#94a3b8"
                            className={`${themeClasses.input} p-4`}
                        />
                    </View>

                    {/* Intelligence */}
                    <View>
                        <View className="flex-row items-center mb-4">
                            <Sparkles size={16} color="#fbbf24" className="mr-2" />
                            <Text className={`${themeClasses.textPrimary} font-bold text-lg`}>Inteligência</Text>
                        </View>

                        <Text className={`${themeClasses.textSecondary} font-bold mb-3`}>Instruções do Sistema (Prompt)</Text>
                        <TextInput
                            value={prompt}
                            onChangeText={setPrompt}
                            placeholder="Como o tutor deve se comportar? O que ele sabe?"
                            placeholderTextColor="#94a3b8"
                            multiline
                            textAlignVertical="top"
                            className={`${themeClasses.input} p-4 min-h-[120px]`}
                        />

                        {/* REMOVED: Allow Web Search Switch (Default is ALWAYS TRUE) */}

                        <View className={`flex-row items-center justify-between mt-4 ${themeClasses.softSurface} p-4`}>
                            <View className="flex-row items-center flex-1 mr-4">
                                <FolderOpen size={20} color="#eab308" />
                                <View className="ml-3">
                                    <Text className={`${themeClasses.textPrimary} font-bold`}>Apenas Fontes</Text>
                                    <Text className={`${themeClasses.textMuted} text-xs`}>Responder estritamente com base nos arquivos enviados. (Desativa conhecimento geral)</Text>
                                </View>
                            </View>
                            <Switch
                                value={strictContext}
                                onValueChange={(val) => {
                                    setStrictContext(val);
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
                            <Text className={`${themeClasses.textPrimary} font-bold text-lg`}>Organização</Text>
                        </View>

                        <Text className={`${themeClasses.textSecondary} font-bold mb-4`}>Categorias (Máx 3)</Text>
                        <View className="flex-row flex-wrap gap-2 mb-8">
                            {categories.map(cat => {
                                const catId = String(cat.id);
                                const isSelected = selectedCategories.includes(catId);
                                return (
                                    <Pressable
                                        key={catId}
                                        onPress={() => toggleCategory(catId)}
                                        className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-indigo-500 border-indigo-500' : `${themeClasses.softSurface} border-gray-200 dark:border-white/10`}`}
                                    >
                                        <Text className={`${isSelected ? 'text-white font-bold' : themeClasses.textSecondary}`}>{cat.name}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text className={`${themeClasses.textSecondary} font-bold mb-4`}>Vincular Espaço de Estudo (Opcional)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Pressable
                                onPress={() => setSelectedSpaceId(null)}
                                className={`mr-4 p-4 rounded-xl border w-[140px] h-[100px] justify-between ${selectedSpaceId === null ? 'bg-indigo-500 border-indigo-500' : `${themeClasses.softSurface} border-gray-200 dark:border-white/10`}`}
                            >
                                <FolderOpen size={24} color={selectedSpaceId === null ? '#fff' : "#94a3b8"} />
                                <Text className={`${selectedSpaceId === null ? 'text-white' : themeClasses.textMuted} font-medium`}>Nenhum</Text>
                            </Pressable>

                            {spaces.map(space => {
                                const isSelected = selectedSpaceId === space.id;
                                return (
                                    <Pressable
                                        key={space.id}
                                        onPress={() => setSelectedSpaceId(space.id)}
                                        className={`mr-4 p-4 rounded-xl border w-[140px] h-[100px] justify-between ${isSelected ? 'bg-indigo-500 border-indigo-500' : `${themeClasses.softSurface} border-gray-200 dark:border-white/10`}`}
                                    >
                                        <FolderOpen size={24} color={isSelected ? '#fff' : "#94a3b8"} />
                                        <Text className={`font-medium ${isSelected ? 'text-white' : themeClasses.textMuted}`} numberOfLines={2}>
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
