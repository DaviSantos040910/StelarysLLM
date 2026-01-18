import { BookOpen, ChevronDown, FileText, Layers, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { ArtifactGenerationOptions, ArtifactType } from '../../types/studio';
import { SourceSelector } from './SourceSelector';

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
    const [customInstructions, setCustomInstructions] = useState('');
    const [includeChatHistory, setIncludeChatHistory] = useState(false);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

    const [isSourceSelectorVisible, setIsSourceSelectorVisible] = useState(false);

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

    const handleGenerate = () => {
        onGenerate({
            quantity: getQuantityValue(quantityOption),
            difficulty,
            customInstructions,
            includeChatHistory,
            sourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : undefined
        });
        onClose();
    };

    const getTitle = () => {
        switch(artifactType) {
            case 'QUIZ': return 'Personalizar Quiz';
            case 'FLASHCARD': return 'Personalizar Flashcards';
            case 'WORKBOOK': return 'Personalizar Apostila';
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
                <View className="bg-space-light rounded-t-3xl border-t border-white/10 p-6 pb-10 max-h-[85%]">

                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-starlight text-xl font-bold">{getTitle()}</Text>
                        <Pressable onPress={onClose} className="p-2 bg-white/5 rounded-full">
                            <X size={24} color="#94a3b8" />
                        </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>

                        {/* 1. Quantity */}
                        <Text className="text-starlight font-bold mb-3">Número de {getUnitLabel()}</Text>
                        <View className="flex-row gap-3 mb-6">
                            {QUANTITY_OPTIONS.map(opt => {
                                const isSelected = quantityOption === opt.id;
                                return (
                                    <Pressable
                                        key={opt.id}
                                        onPress={() => setQuantityOption(opt.id)}
                                        className={`flex-1 py-3 rounded-xl border items-center justify-center ${
                                            isSelected ? 'bg-white text-black border-white' : 'bg-transparent border-white/20'
                                        }`}
                                    >
                                        <Text className={`font-bold ${isSelected ? 'text-black' : 'text-gray-400'}`}>
                                            {opt.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* 2. Difficulty */}
                        <Text className="text-starlight font-bold mb-3">Nível de dificuldade</Text>
                        <View className="flex-row gap-3 mb-6">
                            {DIFFICULTY_LEVELS.map(level => {
                                const isSelected = difficulty === level.id;
                                return (
                                    <Pressable
                                        key={level.id}
                                        onPress={() => setDifficulty(level.id as any)}
                                        className={`flex-1 py-3 rounded-xl border items-center justify-center ${
                                            isSelected ? 'bg-white/10 border-cosmic-purple' : 'bg-transparent border-white/20'
                                        }`}
                                    >
                                        {isSelected && <View className="absolute left-3 w-2 h-2 rounded-full bg-cosmic-purple" />}
                                        <Text className={`font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                            {level.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* 3. Sources */}
                        <Text className="text-starlight font-bold mb-3">Fontes ({selectedSourceIds.length})</Text>
                        <Pressable
                            onPress={() => setIsSourceSelectorVisible(true)}
                            className="flex-row items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 mb-6 active:bg-white/10"
                        >
                            <View className="flex-row items-center flex-1">
                                <Layers size={20} color="#818cf8" />
                                <Text className="text-gray-300 ml-3" numberOfLines={1}>
                                    {selectedSourceIds.length === 0
                                        ? "Todas as fontes disponíveis"
                                        : `${selectedSourceIds.length} fontes selecionadas`}
                                </Text>
                            </View>
                            <ChevronDown size={20} color="#64748b" />
                        </Pressable>

                        {/* 4. Instructions */}
                        <Text className="text-starlight font-bold mb-3">Instruções adicionais</Text>
                        <TextInput
                            value={customInstructions}
                            onChangeText={setCustomInstructions}
                            placeholder="Ex: Focar em datas históricas..."
                            placeholderTextColor="#64748b"
                            multiline
                            className="bg-white/5 text-starlight p-4 rounded-xl border border-white/10 min-h-[100px] mb-6"
                            textAlignVertical="top"
                        />

                        {/* 5. Chat History Context */}
                        <View className="flex-row items-center justify-between mb-8">
                            <View className="flex-row items-center flex-1 mr-4">
                                <View className="p-2 bg-white/5 rounded-lg mr-3">
                                    <FileText size={20} color="#34d399" />
                                </View>
                                <View>
                                    <Text className="text-starlight font-bold">Incluir histórico do chat</Text>
                                    <Text className="text-gray-500 text-xs">Usa as últimas mensagens como contexto</Text>
                                </View>
                            </View>
                            <Switch
                                value={includeChatHistory}
                                onValueChange={setIncludeChatHistory}
                                trackColor={{ false: '#334155', true: '#818cf8' }}
                                thumbColor="#fff"
                            />
                        </View>

                        {/* Action Button */}
                        <Pressable
                            onPress={handleGenerate}
                            className="bg-cosmic-purple py-4 rounded-2xl items-center shadow-lg shadow-indigo-500/30 active:opacity-90 mb-6"
                        >
                            <Text className="text-white font-bold text-lg">Gerar Artefato</Text>
                        </Pressable>

                    </ScrollView>
                </View>
            </View>

            {/* Nested Modal for Sources */}
            <SourceSelector
                visible={isSourceSelectorVisible}
                onClose={() => setIsSourceSelectorVisible(false)}
                chatId={chatId}
                selectedIds={selectedSourceIds}
                onSelectionChange={setSelectedSourceIds}
            />
        </Modal>
    );
};
