import { ChevronDown, Layers, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View, Alert } from 'react-native';
import { ArtifactGenerationOptions, ArtifactType } from '../../types/studio';
import { SourceSelector } from './SourceSelector';
import { themeClasses } from '../../theme/classes';

interface ArtifactConfigModalProps {
    visible: boolean;
    onClose: () => void;
    onGenerate: (options: ArtifactGenerationOptions) => void;
    artifactType: ArtifactType;
    chatId: string;
}

const DIFFICULTY_LEVELS = [
    { id: 'Easy', label: 'Fácil' },
    { id: 'Medium', label: 'Médio (padrão)' },
    { id: 'Hard', label: 'Difícil' },
];

const QUANTITY_OPTIONS = [
    { id: 'fewer', label: 'Menos', val: 5 },
    { id: 'standard', label: 'Padrão', val: 10 },
    { id: 'more', label: 'Mais', val: 20 },
];

const DURATION_OPTIONS = [
    { id: 'Short', label: 'Curto (~5min)' },
    { id: 'Medium', label: 'Médio (~15min)' },
    { id: 'Long', label: 'Longo (~30min)' },
];

export const ArtifactConfigModal: React.FC<ArtifactConfigModalProps> = ({
    visible,
    onClose,
    onGenerate,
    artifactType,
    chatId
}) => {
    // State
    const [quantityOption, setQuantityOption] = useState('standard');
    const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
    const [duration, setDuration] = useState<'Short' | 'Medium' | 'Long'>('Medium');
    const [customInstructions, setCustomInstructions] = useState('');
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

    // UI State: Wizard Mode (Config vs Source Selection)
    const [viewMode, setViewMode] = useState<'config' | 'sources'>('config');
    const [sourceNames, setSourceNames] = useState<Record<string, string>>({});

    // Dynamic Labels based on Type
    const getUnitLabel = () => {
        switch (artifactType) {
            case 'QUIZ': return 'questões';
            case 'FLASHCARD': return 'cartões';
            case 'SLIDE': return 'slides';
            case 'WORKBOOK': return 'páginas';
            default: return 'itens';
        }
    };

    const getQuantityValue = (optionId: string) => {
        const opt = QUANTITY_OPTIONS.find(o => o.id === optionId);
        let val = opt ? opt.val : 10;

        // Adjust for Slides/Workbooks which should be fewer
        if (artifactType === 'SLIDE' || artifactType === 'WORKBOOK') {
            if (optionId === 'fewer') return 3;
            if (optionId === 'standard') return 6;
            if (optionId === 'more') return 10;
        }
        return val;
    };

    const isValid = () => {
        // Validation: Must select source. Instructions alone are NOT enough.
        return selectedSourceIds.length > 0;
    };

    const handleGenerate = () => {
        if (!isValid()) {
            Alert.alert("Atenção", "Selecione pelo menos uma fonte de conteúdo.");
            return;
        }

        // Construct Dynamic Title
        let dynamicTitle = '';
        if (selectedSourceIds.length > 0) {
            const firstId = selectedSourceIds[0];
            const firstName = sourceNames[firstId] || 'Arquivo';

            if (selectedSourceIds.length > 1) {
                dynamicTitle = `${firstName} (+${selectedSourceIds.length - 1})`;
            } else {
                dynamicTitle = firstName;
            }
        } else {
            dynamicTitle = 'Chat History';
        }

        onGenerate({
            // Default to 1 for Podcast if not specified
            quantity: artifactType === 'PODCAST' ? 1 : getQuantityValue(quantityOption),
            difficulty,
            targetDuration: artifactType === 'PODCAST' ? duration : undefined,
            customInstructions,
            sourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
            title: dynamicTitle
        });
        onClose();
    };

    const getTitle = () => {
        switch(artifactType) {
            case 'QUIZ': return 'Personalizar Quiz';
            case 'FLASHCARD': return 'Personalizar Flashcards';
            case 'WORKBOOK': return 'Personalizar Apostila';
            case 'PODCAST': return 'Personalizar o Resumo em Áudio';
            default: return 'Personalizar';
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/60">
                {viewMode === 'sources' ? (
                     <SourceSelector
                        onClose={() => setViewMode('config')}
                        chatId={chatId}
                        selectedIds={selectedSourceIds}
                        onSelectionChange={(ids, names) => {
                            setSelectedSourceIds(ids);
                            // Merge new names into map
                            if (names) {
                                setSourceNames(prev => ({...prev, ...names}));
                            }
                        }}
                    />
                ) : (
                    <View className={`rounded-t-3xl border-t border-gray-200 dark:border-white/10 p-6 pb-10 max-h-[90%] ${themeClasses.surface}`}>

                        {/* Header */}
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className={`${themeClasses.textPrimary} text-xl font-bold text-center flex-1`}>{getTitle()}</Text>
                            <Pressable onPress={onClose} className={`p-2 rounded-full absolute right-0 ${themeClasses.softSurface}`}>
                                <X size={24} color="#94a3b8" />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>

                            {/* 1. Quantity OR Duration */}
                            {artifactType === 'PODCAST' ? (
                                <>
                                    <Text className={`${themeClasses.textPrimary} font-bold mb-3`}>Duração</Text>
                                    <View className="flex-row gap-3 mb-6">
                                        {DURATION_OPTIONS.map(opt => {
                                            const isSelected = duration === opt.id;
                                            return (
                                                <Pressable
                                                    key={opt.id}
                                                    onPress={() => setDuration(opt.id as any)}
                                                    className={`flex-1 py-3 rounded-xl border items-center justify-center ${
                                                        isSelected ? 'bg-white dark:bg-white text-black border-white' : 'bg-transparent border-gray-300 dark:border-white/20'
                                                    }`}
                                                >
                                                    <Text className={`font-bold text-xs ${isSelected ? 'text-black' : themeClasses.textMuted}`}>
                                                        {opt.label}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text className={`${themeClasses.textPrimary} font-bold mb-3`}>Número de {getUnitLabel()}</Text>
                                    <View className="flex-row gap-3 mb-6">
                                        {QUANTITY_OPTIONS.map(opt => {
                                            const isSelected = quantityOption === opt.id;
                                            return (
                                                <Pressable
                                                    key={opt.id}
                                                    onPress={() => setQuantityOption(opt.id)}
                                                    className={`flex-1 py-3 rounded-xl border items-center justify-center ${
                                                        isSelected ? 'bg-white dark:bg-white text-black border-white' : 'bg-transparent border-gray-300 dark:border-white/20'
                                                    }`}
                                                >
                                                    <Text className={`font-bold ${isSelected ? 'text-black' : themeClasses.textMuted}`}>
                                                        {opt.label}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </>
                            )}

                            {/* 2. Difficulty (Shown for ALL types) */}
                            <Text className={`${themeClasses.textPrimary} font-bold mb-3`}>Nível de dificuldade</Text>
                            <View className="flex-row gap-3 mb-6">
                                {DIFFICULTY_LEVELS.map(level => {
                                    const isSelected = difficulty === level.id;
                                    return (
                                        <Pressable
                                            key={level.id}
                                            onPress={() => setDifficulty(level.id as any)}
                                            className={`flex-1 py-3 rounded-xl border items-center justify-center ${
                                                isSelected ? 'bg-white/10 border-cosmic-purple' : 'bg-transparent border-gray-300 dark:border-white/20'
                                            }`}
                                        >
                                            {isSelected && <View className="absolute left-3 w-2 h-2 rounded-full bg-cosmic-purple" />}
                                            <Text className={`font-medium ${isSelected ? themeClasses.textPrimary : themeClasses.textMuted}`}>
                                                {level.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            {/* 3. Sources */}
                            <Text className={`${themeClasses.textPrimary} font-bold mb-3`}>Fontes de Conteúdo</Text>
                            <Pressable
                                onPress={() => setViewMode('sources')}
                                className={`flex-row items-center justify-between p-4 rounded-xl mb-6 ${themeClasses.softSurface} ${themeClasses.press}`}
                            >
                                <View className="flex-row items-center flex-1">
                                    <Layers size={20} color="#818cf8" />
                                    <Text className={`${themeClasses.textSecondary} ml-3`} numberOfLines={1}>
                                        {selectedSourceIds.length === 0
                                            ? "Selecionar arquivos/fontes..."
                                            : `${selectedSourceIds.length} fontes selecionadas`}
                                    </Text>
                                </View>
                                <ChevronDown size={20} color="#64748b" />
                            </Pressable>

                            {/* 4. Instructions */}
                            <Text className={`${themeClasses.textPrimary} font-bold mb-3`}>Comando (Opcional)</Text>
                            <TextInput
                                value={customInstructions}
                                onChangeText={setCustomInstructions}
                                placeholder="Ex: Foque nos conceitos avançados de..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                className={`${themeClasses.input} p-4 min-h-[100px] mb-6`}
                                textAlignVertical="top"
                            />

                            {/* Action Button */}
                            <Pressable
                                onPress={handleGenerate}
                                className={`py-4 rounded-2xl items-center shadow-lg mb-6 ${isValid() ? 'bg-cosmic-purple shadow-indigo-500/30' : 'bg-gray-700 opacity-50'}`}
                            >
                                <Text className="text-white font-bold text-lg">Gerar</Text>
                            </Pressable>

                        </ScrollView>
                    </View>
                )}
            </View>
        </Modal>
    );
};
