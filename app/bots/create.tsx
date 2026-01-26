import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Camera, Check, Globe, Image as ImageIcon, Palette, Sparkles, FolderOpen, Layers } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAttachmentPicker } from '../../src/hooks/useAttachmentPicker';
import { botService } from '../../src/services/botService';
import { exploreService, Category } from '../../src/services/exploreService';
import { libraryService } from '../../src/services/libraryService';
import { StudySpace } from '../../src/types/studio';

const THEME_COLORS = [
    '#818cf8', // Indigo (Default)
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#a855f7', // Purple
    '#ec4899', // Pink
];

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
    const [themeColor, setThemeColor] = useState(THEME_COLORS[0]);

    // Selectors State
    const [avatar, setAvatar] = useState<any>(null);
    const [bgImage, setBgImage] = useState<any>(null);
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
            if (bot.theme_color) setThemeColor(bot.theme_color);

            if (bot.avatar_url) setAvatar({ uri: bot.avatar_url });
            if (bot.background_image) setBgImage({ uri: bot.background_image });

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
        const result = await pickImage();
        if (result && result[0]) setAvatar(result[0]);
    };

    const handlePickBg = async () => {
        const result = await pickImage();
        if (result && result[0]) setBgImage({ uri: result[0].uri, name: result[0].name, mimeType: result[0].mimeType });
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
                    theme_color: themeColor,
                    allow_web_search: allowWebSearch,
                    publicity: 'Public',
                    avatar: avatar?.uri?.startsWith('http') ? undefined : avatar, // Only send if changed (local uri)
                    background_image: bgImage?.uri?.startsWith('http') ? undefined : bgImage,
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
                    theme_color: themeColor,
                    allow_web_search: allowWebSearch,
                    publicity: 'Public',
                    avatar,
                    background_image: bgImage,
                    category_ids: selectedCategories,
                    study_space_ids: selectedSpaceId ? [selectedSpaceId] : undefined
                });

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

        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Falha ao salvar o tutor.");
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

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {/* 1. Identity Section (Avatar & Cover) */}
                <View className="items-center mb-8 relative">
                    {/* Cover Image Area */}
                    <Pressable
                        onPress={handlePickBg}
                        className="w-full h-48 bg-white/5 items-center justify-center relative overflow-hidden"
                    >
                        {bgImage ? (
                            <Image source={{ uri: bgImage.uri }} className="w-full h-full opacity-60" resizeMode="cover" />
                        ) : (
                            <View className="items-center justify-center w-full h-full" style={{ backgroundColor: themeColor + '20' }}>
                                <ImageIcon color={themeColor} size={32} opacity={0.5} />
                                <Text className="text-gray-400 text-xs mt-2">Toque para adicionar capa</Text>
                            </View>
                        )}
                        <View className="absolute bottom-2 right-2 bg-black/60 p-2 rounded-full">
                            <Camera size={16} color="#fff" />
                        </View>
                    </Pressable>

                    {/* Avatar - Overlapping Cover */}
                    <Pressable
                        onPress={handlePickAvatar}
                        className="w-28 h-28 rounded-full bg-space-light border-4 border-space-dark absolute -bottom-14 items-center justify-center overflow-hidden"
                    >
                        {avatar ? (
                            <Image source={{ uri: avatar.uri }} className="w-full h-full" />
                        ) : (
                            <View className="w-full h-full items-center justify-center bg-white/10">
                                <Sparkles size={32} color="#94a3b8" />
                            </View>
                        )}
                        <View className="absolute inset-0 bg-black/30 items-center justify-center opacity-0 active:opacity-100">
                            <Camera size={24} color="#fff" />
                        </View>
                    </Pressable>
                </View>

                {/* Spacer for Avatar overlap */}
                <View className="h-16" />

                <View className="px-6 space-y-6">
                    {/* Basic Info */}
                    <View>
                        <Text className="text-gray-400 font-bold mb-2">Nome do Tutor</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Ex: Professor de História"
                            placeholderTextColor="#64748b"
                            className="bg-white/5 text-starlight p-4 rounded-xl border border-white/10 text-lg font-bold"
                        />
                    </View>

                    <View>
                        <Text className="text-gray-400 font-bold mb-2">Descrição (Opcional)</Text>
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
                        <View className="flex-row items-center mb-2">
                            <Sparkles size={16} color="#fbbf24" className="mr-2" />
                            <Text className="text-starlight font-bold text-lg">Inteligência</Text>
                        </View>

                        <Text className="text-gray-400 font-bold mb-2">Instruções do Sistema (Prompt)</Text>
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
                                onValueChange={setAllowWebSearch}
                                trackColor={{ false: "#334155", true: "#3b82f6" }}
                                thumbColor="#ffffff"
                            />
                        </View>
                    </View>

                    {/* Appearance */}
                    <View>
                        <View className="flex-row items-center mb-4">
                            <Palette size={16} color="#f472b6" className="mr-2" />
                            <Text className="text-starlight font-bold text-lg">Aparência</Text>
                        </View>

                        <Text className="text-gray-400 font-bold mb-3">Cor do Tema</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {THEME_COLORS.map(color => (
                                <Pressable
                                    key={color}
                                    onPress={() => setThemeColor(color)}
                                    className={`w-12 h-12 rounded-full mr-4 items-center justify-center border-2 ${themeColor === color ? 'border-white' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                >
                                    {themeColor === color && <Check size={20} color="#fff" />}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Organization */}
                    <View>
                        <View className="flex-row items-center mb-4">
                            <Layers size={16} color="#34d399" className="mr-2" />
                            <Text className="text-starlight font-bold text-lg">Organização</Text>
                        </View>

                        <Text className="text-gray-400 font-bold mb-3">Categorias (Máx 3)</Text>
                        <View className="flex-row flex-wrap gap-2 mb-6">
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

                        <Text className="text-gray-400 font-bold mb-3">Vincular Espaço de Estudo (Opcional)</Text>
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
                                        <FolderOpen size={24} color={isSelected ? themeColor : "#94a3b8"} />
                                        <Text className={`font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`} numberOfLines={2}>
                                            {space.title}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
