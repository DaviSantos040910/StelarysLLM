import React, { useRef, useMemo } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { SourceRef } from '../../types/chat';
import { FileText, Link, Youtube, Image as ImageIcon, X } from 'lucide-react-native';
import { themeClasses } from '../../theme/classes';
import { useColorScheme } from 'nativewind';

interface ReferencesSheetProps {
    sources: SourceRef[];
    isVisible: boolean;
    onClose: () => void;
}

const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'url': return <Link size={20} color="#94a3b8" />;
        case 'youtube': return <Youtube size={20} color="#ef4444" />;
        case 'image': return <ImageIcon size={20} color="#f472b6" />;
        default: return <FileText size={20} color="#818cf8" />;
    }
};

const getSubtitle = (source: SourceRef) => {
    if (source.type === 'URL') {
        try {
            return `Site • ${new URL(source.url || '').hostname}`;
        } catch {
            return 'Site';
        }
    }
    if (source.type === 'YOUTUBE') return 'YouTube Video';
    if (source.type === 'IMAGE') return 'Imagem';
    return `PDF • ${source.title}`; // Fallback assuming file
};

export const ReferencesSheet = ({ sources, isVisible, onClose }: ReferencesSheetProps) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['50%'], []);
    const { colorScheme } = useColorScheme();

    // Effect to open/close based on prop
    React.useEffect(() => {
        if (isVisible) {
            bottomSheetRef.current?.expand();
        } else {
            bottomSheetRef.current?.close();
        }
    }, [isVisible]);

    const handleSheetChanges = (index: number) => {
        if (index === -1) {
            onClose();
        }
    };

    const handlePressSource = (url?: string) => {
        if (url) {
            Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
        }
    };

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            onChange={handleSheetChanges}
            backgroundStyle={{ backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#ffffff' }}
            handleIndicatorStyle={{ backgroundColor: colorScheme === 'dark' ? '#475569' : '#cbd5e1' }}
            backdropComponent={(props) => (
                <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
            )}
        >
            <View className="flex-1 px-4">
                <View className={`flex-row items-center justify-between mb-4 ${themeClasses.headerBorder} pb-4`}>
                    <Text className={`${themeClasses.textPrimary} text-lg font-bold`}>Referências</Text>
                    <Pressable onPress={() => bottomSheetRef.current?.close()} className={`p-2 rounded-full ${themeClasses.softSurface}`}>
                        <X size={20} color="#94a3b8" />
                    </Pressable>
                </View>

                <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                    {sources.map((source, idx) => (
                        <Pressable
                            key={`${source.id}-${idx}`}
                            onPress={() => handlePressSource(source.url)}
                            className={`flex-row items-center p-3 mb-2 rounded-xl ${themeClasses.softSurface} ${themeClasses.press}`}
                        >
                            <View className="w-10 h-10 items-center justify-center bg-gray-200 dark:bg-space-dark rounded-lg mr-3">
                                <Text className="text-xs text-gray-500 font-bold absolute top-0.5 right-1">{source.index}</Text>
                                {getIcon(source.type)}
                            </View>
                            <View className="flex-1">
                                <Text className={`${themeClasses.textPrimary} font-bold`} numberOfLines={1}>
                                    {source.title}
                                </Text>
                                <Text className={`${themeClasses.textMuted} text-xs`}>
                                    {getSubtitle(source)}
                                </Text>
                            </View>
                            {source.url && <Link size={16} color="#64748b" />}
                        </Pressable>
                    ))}
                </BottomSheetScrollView>
            </View>
        </BottomSheet>
    );
};
