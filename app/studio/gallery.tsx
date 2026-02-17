import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
    ArrowLeft,
    Book,
    BookOpen,
    ChevronDown,
    Download,
    FileQuestion,
    FileText,
    Headphones,
    Monitor,
    Play,
    RefreshCw,
    Table,
    X
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMiniPlayerHeight } from '../../src/hooks/useMiniPlayerHeight';
import { studioService } from '../../src/services/studioService';
import { useAudioPlayerStore } from '../../src/stores/audioPlayerStore';
import { ArtifactType, FlashcardItem, getExportFormat, KnowledgeArtifact, QuizQuestion, SlidePage } from '../../src/types/studio';

// Viewers
import { FlashcardViewer } from '../../src/components/studio/FlashcardViewer';
import { PodcastPlayer } from '../../src/components/studio/PodcastPlayer';
import { QuizViewer } from '../../src/components/studio/QuizViewer';
import { SlideViewer } from '../../src/components/studio/SlideViewer';
import { SpreadsheetViewer } from '../../src/components/studio/SpreadsheetViewer';
import { WorkbookViewer } from '../../src/components/studio/WorkbookViewer';
import { themeClasses } from '../../src/theme/classes';

const FILTER_TABS = [
    { id: 'ALL', label: 'Todos' },
    { id: 'PODCAST', label: 'Áudio' },
    { id: 'DOCS', label: 'Docs' },
    { id: 'QUIZ', label: 'Quiz' },
];

const getColor = (type: ArtifactType) => {
    switch (type) {
        case 'PODCAST': return '#818cf8';
        case 'QUIZ': return '#2dd4bf';
        case 'FLASHCARD': return '#f472b6';
        case 'SLIDE': return '#fbbf24';
        case 'SUMMARY': return '#c084fc';
        case 'SPREADSHEET': return '#34d399';
        case 'WORKBOOK': return '#60a5fa';
        default: return '#94a3b8';
    }
};

const getIcon = (type: ArtifactType, color: string) => {
    switch (type) {
        case 'PODCAST': return <Headphones color={color} size={24} />;
        case 'QUIZ': return <FileQuestion color={color} size={24} />;
        case 'FLASHCARD': return <BookOpen color={color} size={24} />;
        case 'SLIDE': return <Monitor color={color} size={24} />;
        case 'SPREADSHEET': return <Table color={color} size={24} />;
        case 'WORKBOOK': return <Book color={color} size={24} />;
        default: return <FileText color={color} size={24} />;
    }
};

const GalleryItem = React.memo(({ item, index, onPress }: { item: KnowledgeArtifact, index: number, onPress: (item: KnowledgeArtifact) => void }) => {
    const color = getColor(item.type);
    const icon = getIcon(item.type, color);
    const dateStr = formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true, locale: ptBR });

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 50)}
            className="flex-1 m-2"
        >
            <Pressable
                onPress={() => onPress(item)}
                className={`flex-1 p-4 rounded-2xl min-h-[140px] justify-between transition-colors ${themeClasses.surface} ${themeClasses.press}`}
            >
                <View className="flex-row justify-between items-start">
                    <View className={`p-2 rounded-full ${themeClasses.softSurface}`}>
                        {icon}
                    </View>

                    {/* Status Badges */}
                    {item.status === 'processing' ? (
                        <View className="px-2 py-1 bg-yellow-500/20 rounded-lg">
                            <Text className="text-yellow-500 text-xs font-bold">Gerando...</Text>
                        </View>
                    ) : item.status === 'error' ? (
                        <View className="px-2 py-1 bg-red-500/20 rounded-lg">
                            <Text className="text-red-500 text-xs font-bold">Falhou</Text>
                        </View>
                    ) : (
                        <>
                            {item.type === 'PODCAST' && (
                                <View className="p-1.5 bg-cosmic-purple/20 rounded-full">
                                    <Play size={12} color="#818cf8" fill="#818cf8" />
                                </View>
                            )}
                            {item.type === 'QUIZ' && item.score && (
                                <View className="px-2 py-1 bg-teal-500/20 rounded-lg">
                                    <Text className="text-teal-400 text-xs font-bold">{item.score}</Text>
                                </View>
                            )}
                        </>
                    )}
                </View>

                <View>
                    <Text className={`${themeClasses.textPrimary} font-bold text-base leading-tight mb-1`} numberOfLines={2}>
                        {item.title}
                    </Text>
                    <Text className={`${themeClasses.textMuted} text-xs`}>{dateStr}</Text>
                </View>

                <View className={`mt-2 pt-2 border-t border-gray-200 dark:border-white/5`}>
                    {item.type === 'PODCAST' && <Text className={`${themeClasses.textMuted} text-xs font-medium`}>{item.duration || '00:00'} min</Text>}
                    {item.type === 'QUIZ' && <Text className={`${themeClasses.textMuted} text-xs font-medium`}>Revisar</Text>}
                    {item.type === 'FLASHCARD' && <Text className={`${themeClasses.textMuted} text-xs font-medium`}>{Array.isArray(item.content) ? item.content.length : 0} cards</Text>}
                    {item.type === 'SLIDE' && <Text className={`${themeClasses.textMuted} text-xs font-medium`}>{Array.isArray(item.content) ? item.content.length : 0} slides</Text>}
                    {['SPREADSHEET', 'WORKBOOK'].includes(item.type) && <Text className={`${themeClasses.textMuted} text-xs font-medium`}>Ver conteúdo</Text>}
                </View>
            </Pressable>
        </Animated.View>
    );
});

export default function StudioGalleryScreen() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const miniPlayerHeight = useMiniPlayerHeight();
    // Ensure chatId and openArtifactId are read from params
    const { chatId, openArtifactId } = useLocalSearchParams<{ chatId: string; openArtifactId?: string }>();
    const { minimize, isMinimized, artifactId: currentArtifactId } = useAudioPlayerStore();

    const [activeFilter, setActiveFilter] = useState('ALL');
    const [artifacts, setArtifacts] = useState<KnowledgeArtifact[]>([]);
    const [loading, setLoading] = useState(true);

    // Viewer State
    const [selectedArtifact, setSelectedArtifact] = useState<KnowledgeArtifact | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Track if opened via restoration to handle navigation back
    const [wasRestored, setWasRestored] = useState(false);

    // Track if we've already tried to open the artifact from URL
    const [hasOpenedFromUrl, setHasOpenedFromUrl] = useState(false);

    // Efeito para abrir o modal quando o player é maximizado estando na galeria
    React.useEffect(() => {
        // Se o player foi maximizado (isMinimized === false) e temos um artifactId
        // e não temos nenhum artefato selecionado atualmente
        // E TAMBÉM se o artefato atual for um Podcast (para evitar abrir viewer errado)
        if (!isMinimized && currentArtifactId && !selectedArtifact && artifacts.length > 0) {
            const artifact = artifacts.find(a => a.id === currentArtifactId);
            if (artifact && artifact.type === 'PODCAST') {
                setSelectedArtifact(artifact);
            }
        }
    }, [isMinimized, currentArtifactId, artifacts, selectedArtifact]);

    const handleCloseViewer = () => {
        setSelectedArtifact(null);
        if (wasRestored) {
            setWasRestored(false);
            router.back();
        }
    };

    const handleMinimizeViewer = () => {
        if (selectedArtifact?.type === 'PODCAST') {
            minimize();
            handleCloseViewer();
        }
    };

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const data = await studioService.getArtifacts(chatId || '0');
            setArtifacts(data);

            // Se tiver openArtifactId na URL e ainda não abrimos, encontra e abre o artefato
            if (openArtifactId && !hasOpenedFromUrl) {
                const artifactIdNum = parseInt(openArtifactId, 10);
                const artifactToOpen = data.find(a => a.id === artifactIdNum);
                if (artifactToOpen) {
                    setSelectedArtifact(artifactToOpen);
                    setWasRestored(true);
                }
                setHasOpenedFromUrl(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [chatId])
    );

    // Polling effect for processing artifacts
    React.useEffect(() => {
        const hasProcessing = artifacts.some(a => a.status === 'processing');
        let interval: ReturnType<typeof setInterval>;

        if (hasProcessing) {
            interval = setInterval(() => {
                loadData(false);
            }, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [artifacts]);

    const filteredData = activeFilter === 'ALL'
        ? artifacts
        : artifacts.filter(item => {
            if (activeFilter === 'PODCAST') return item.type === 'PODCAST';
            if (activeFilter === 'DOCS') return ['FLASHCARD', 'SLIDE', 'SPREADSHEET', 'WORKBOOK'].includes(item.type);
            if (activeFilter === 'QUIZ') return item.type === 'QUIZ';
            return true;
        });

    const handleExport = async () => {
        if (!selectedArtifact) return;

        setIsExporting(true);
        try {
            const format = getExportFormat(selectedArtifact.type);
            const localUri = await studioService.exportArtifact(selectedArtifact.id, format);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(localUri);
            } else {
                Alert.alert("Sucesso", "Arquivo salvo em: " + localUri);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Falha ao exportar arquivo.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleArtifactPress = useCallback((item: KnowledgeArtifact) => {
        setSelectedArtifact(item);
    }, []);

    const renderItem = useCallback(({ item, index }: { item: KnowledgeArtifact, index: number }) => (
        <GalleryItem item={item} index={index} onPress={handleArtifactPress} />
    ), [handleArtifactPress]);

    // Polling inside viewer
    React.useEffect(() => {
        let pollInterval: ReturnType<typeof setInterval>;

        if (selectedArtifact && selectedArtifact.status === 'processing') {
            pollInterval = setInterval(async () => {
                try {
                    const updated = await studioService.getArtifact(selectedArtifact.id);
                    // If status changed or processing details updated
                    if (updated.status !== 'processing' || updated.current_step !== selectedArtifact.current_step) {
                        setSelectedArtifact(updated);
                        // Update in list as well
                        setArtifacts(prev => prev.map(p => p.id === updated.id ? updated : p));
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 2000);
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [selectedArtifact]);

    // Render Content based on Type
    const renderViewer = () => {
        if (!selectedArtifact) return null;

        // 1. Loading State
        if (selectedArtifact.status === 'processing') {
            return (
                <View className={`flex-1 justify-center items-center ${themeClasses.screen}`}>
                    <ActivityIndicator size="large" color="#818cf8" />
                    <Text className={`${themeClasses.textPrimary} mt-4 text-lg font-medium`}>
                        Gerando Artefato...
                    </Text>
                    <Text className={`${themeClasses.textMuted} mt-2 text-sm`}>
                        Isso pode levar alguns segundos.
                    </Text>
                    <Pressable onPress={handleCloseViewer} className="mt-8 p-3 bg-gray-700 rounded-full">
                        <X color="#fff" size={24} />
                    </Pressable>
                </View>
            );
        }

        // 2. Error State
        if (selectedArtifact.status === 'error') {
            return (
                <View className={`flex-1 justify-center items-center ${themeClasses.screen} px-6`}>
                    <View className="bg-red-500/10 p-4 rounded-full mb-4">
                        <X color="#ef4444" size={40} />
                    </View>
                    <Text className={`${themeClasses.textPrimary} text-xl font-bold text-center mb-2`}>
                        Falha na Geração
                    </Text>
                    <Text className={`${themeClasses.textMuted} text-center mb-8`}>
                        Não foi possível criar o artefato. Tente novamente mais tarde.
                    </Text>

                    <Pressable
                        onPress={handleCloseViewer}
                        className="bg-gray-700 py-3 px-6 rounded-xl w-full mb-3"
                    >
                        <Text className="text-white text-center font-bold">Fechar</Text>
                    </Pressable>
                </View>
            );
        }

        // 3. Ready State
        const ViewerContent = () => {
            switch (selectedArtifact.type) {
                case 'SLIDE': return <SlideViewer data={selectedArtifact.content as SlidePage[]} />;
                case 'QUIZ': return <QuizViewer data={selectedArtifact.content as QuizQuestion[]} onFinish={handleCloseViewer} />;
                case 'FLASHCARD': return <FlashcardViewer data={selectedArtifact.content as FlashcardItem[]} />;
                case 'PODCAST': return <PodcastPlayer uri={selectedArtifact.media_url} title={selectedArtifact.title} artifactId={selectedArtifact.id} chatId={chatId} chapters={selectedArtifact.chapters} transcript={selectedArtifact.transcript} />;
                case 'SPREADSHEET': return <SpreadsheetViewer />;
                case 'WORKBOOK': return <WorkbookViewer />;
                default: return <View />;
            }
        };

        // Default Header for other types
        return (
            <View className={`flex-1 relative ${themeClasses.screen}`}>
                <View className="absolute top-4 right-4 z-50 flex-row gap-2">
                    {selectedArtifact.type === 'PODCAST' && (
                        <Pressable onPress={handleMinimizeViewer} className="p-2 bg-black/40 rounded-full">
                            <ChevronDown color="#94a3b8" size={24} />
                        </Pressable>
                    )}
                    <Pressable
                        onPress={handleExport}
                        disabled={isExporting}
                        className={`p-2 rounded-full shadow-lg ${isExporting ? 'bg-gray-600' : 'bg-cosmic-purple'}`}
                    >
                        {isExporting ? <ActivityIndicator color="#fff" size="small" /> : <Download color="#fff" size={24} />}
                    </Pressable>
                    <Pressable onPress={handleCloseViewer} className="p-2 bg-black/40 rounded-full">
                        <X color="#fff" size={24} />
                    </Pressable>
                </View>
                <ViewerContent />
            </View>
        );
    };

    return (
        <SafeAreaView className={themeClasses.screen} edges={['top']}>
            {/* Header */}
            <View className={`px-4 py-4 flex-row items-center justify-between mb-2 ${themeClasses.headerBorder}`}>
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className={`p-2 -ml-2 rounded-full ${themeClasses.press}`}>
                        <ArrowLeft color={colorScheme === 'dark' ? '#f8fafc' : '#111827'} size={24} />
                    </Pressable>
                    <Text className={`${themeClasses.textPrimary} text-xl font-bold ml-2`}>Galeria do Studio</Text>
                </View>
                <Pressable onPress={() => loadData(true)} className={`p-2 rounded-full ${themeClasses.press}`}>
                    <RefreshCw color={colorScheme === 'dark' ? '#94a3b8' : '#64748b'} size={20} />
                </Pressable>
            </View>

            {/* Filters */}
            <View className="px-4 mb-4">
                <FlatList
                    data={FILTER_TABS}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item }) => {
                        const isActive = activeFilter === item.id;
                        return (
                            <Pressable
                                onPress={() => setActiveFilter(item.id)}
                                className={`mr-3 px-4 py-2 rounded-full border ${isActive ? 'bg-cosmic-purple border-cosmic-purple' : 'bg-transparent border-gray-300 dark:border-white/20'}`}
                            >
                                <Text className={`${isActive ? 'text-white' : themeClasses.textMuted} font-medium`}>{item.label}</Text>
                            </Pressable>
                        );
                    }}
                />
            </View>

            {/* Grid */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="#818cf8" size="large" />
                </View>
            ) : (
                <FlatList
                    data={filteredData}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    numColumns={2}
                    contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 + miniPlayerHeight }}
                    columnWrapperStyle={{ justifyContent: 'space-between' }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View className="items-center mt-20">
                            <Text className={themeClasses.textMuted}>Nenhum artefato encontrado.</Text>
                        </View>
                    }
                />
            )}

            {/* Artifact Viewer Modal */}
            <Modal
                visible={!!selectedArtifact}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handleCloseViewer}
            >
                {renderViewer()}
            </Modal>

        </SafeAreaView>
    );
}
