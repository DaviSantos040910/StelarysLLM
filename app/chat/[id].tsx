import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, ListRenderItem, Platform, Pressable, View, Alert, ImageBackground } from 'react-native';
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttachmentSheet } from '../../src/components/chat/AttachmentSheet';
import { ChatInput, StagedAttachment } from '../../src/components/chat/ChatInput';
import { ChatMessageItem } from '../../src/components/chat/ChatMessageItem';
import { ChatWelcome } from '../../src/components/chat/ChatWelcome';
import { FloatingTutorCard } from '../../src/components/chat/FloatingTutorCard';
import { KnowledgeActionSheet } from '../../src/components/chat/KnowledgeActionSheet';
import { useAttachmentPicker } from '../../src/hooks/useAttachmentPicker';
import { useMiniPlayerHeight } from '../../src/hooks/useMiniPlayerHeight';
import { botService } from '../../src/services/botService';
import { chatService } from '../../src/services/chatService';
import { useChatStore } from '../../src/stores/chatStore';
import { ChatListItem, Message } from '../../src/types/chat';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Message>);

export default function ChatScreen() {
    const { id, botId, botName, botAvatar, suggestion1, suggestion2, suggestion3 } = useLocalSearchParams();
    const router = useRouter();
    const chatId = id as string;

    const { messages, loadMessages, sendMessage, isLoading, isStreaming, currentChat, loadMoreMessages, uploadFile, setCurrentChat, addSystemMessage, updateMessage, regenerateMessage } = useChatStore();
    const [inputText, setInputText] = useState('');
    const [showScrollDown, setShowScrollDown] = useState(false);

    // Scroll Stability Refs
    const scrollY = useRef(0);
    const lastNewestLocalId = useRef<string | undefined>(undefined);

    // Sheet Visibility States
    const [isAttachmentSheetVisible, setIsAttachmentSheetVisible] = useState(false);
    const [isKnowledgeSheetVisible, setIsKnowledgeSheetVisible] = useState(false);

    const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

    const flatListRef = useRef<FlatList>(null);
    const { pickImage, pickDocument, takePhoto, isPickerLoading } = useAttachmentPicker();

    // Header Animation State
    const translateY = useSharedValue(0);
    const lastContentOffset = useSharedValue(0);
    const isHeaderVisible = useSharedValue(1);

    const miniPlayerHeight = useMiniPlayerHeight();

    // Theme Customization
    const themeColor = '#818cf8'; // Default cosmic purple

    const handleScrollState = (offset: number) => {
        scrollY.current = offset;
        if (offset > 200) {
            setShowScrollDown(true);
        } else {
            setShowScrollDown(false);
        }
    };

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const currentOffset = event.contentOffset.y;
            const diff = currentOffset - lastContentOffset.value;

            runOnJS(handleScrollState)(currentOffset);

            if (diff > 10 && currentOffset > 50) {
                isHeaderVisible.value = withTiming(0, { duration: 300 });
            } else if (diff < -10) {
                isHeaderVisible.value = withTiming(1, { duration: 300 });
            }

            lastContentOffset.value = currentOffset;
        },
    });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: withTiming(isHeaderVisible.value === 1 ? 0 : -100) }],
            opacity: withTiming(isHeaderVisible.value === 1 ? 1 : 0),
        };
    });

    // Initialize Chat Metadata
    useEffect(() => {
        if (botId && botName) {
            const minimalChat: ChatListItem = {
                id: chatId,
                status: 'active',
                last_message_at: '',
                last_message: null,
                bot: {
                    id: botId as string,
                    name: botName as string,
                    avatar_url: botAvatar as string,
                    description: '',
                    suggestion1: suggestion1 as string,
                    suggestion2: suggestion2 as string,
                    suggestion3: suggestion3 as string,
                }
            };
            if (setCurrentChat) setCurrentChat(minimalChat);
        }
        loadMessages(chatId);
        if (botId) {
            botService.getChatBootstrap(botId as string).then(data => {
                if (setCurrentChat) {
                    setCurrentChat({
                        id: chatId,
                        status: 'active',
                        last_message_at: '',
                        last_message: null,
                        bot: {
                            id: botId as string,
                            name: data.bot.name,
                            avatar_url: data.bot.avatarUrl,
                            description: data.welcome || '',
                            suggestion1: data.suggestions?.[0],
                            suggestion2: data.suggestions?.[1],
                            suggestion3: data.suggestions?.[2],
                        }
                    });
                }
            }).catch(console.error);
        }
    }, [chatId, botId]);

    // Smart Auto-Scroll: Only scroll to bottom if a NEW message arrives (user or bot).
    // Ignores updates to existing messages (streaming, status changes) to prevent UX jumping.
    useEffect(() => {
        const newestMsg = messages[0];
        if (!newestMsg) return;

        if (newestMsg.localId !== lastNewestLocalId.current) {
             flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
             lastNewestLocalId.current = newestMsg.localId;
        }
    }, [messages]);

    const handleSend = async (text: string = inputText) => {
        if (!text.trim() && stagedAttachments.length === 0) return;

        // Clear UI immediately to prevent double sends or sticking text
        setInputText('');
        setStagedAttachments([]);

        for (const att of stagedAttachments) {
             if (att.uri) {
                await uploadFile(chatId, {
                    uri: att.uri,
                    name: att.name || 'file',
                    mimeType: att.mimeType || 'application/octet-stream'
                });
            }
        }

        if (text.trim()) {
            await sendMessage(chatId, text);
        }

        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    const handleAudioRecorded = async (uri: string, duration: number) => {
        const file = { uri, name: `audio_${Date.now()}.m4a`, mimeType: 'audio/m4a', duration };
        await uploadFile(chatId, file);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    const handleAddSource = async (file: any, type: 'file' | 'url' | 'youtube') => {
        setIsAttachmentSheetVisible(false);
        try {
            const backendType = type === 'youtube' ? 'YOUTUBE' : type === 'url' ? 'URL' : 'FILE';
            const source = await chatService.addChatSource(chatId, file, backendType);

            if (addSystemMessage) {
                addSystemMessage(`📎 Fonte adicionada ao contexto: ${source.title}`);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Erro", "Falha ao adicionar fonte.");
        }
    };

    const handleDirectAttachment = async (type: 'image' | 'camera') => {
        let results;
        if (type === 'image') results = await pickImage();
        else if (type === 'camera') results = await takePhoto();

        if (results) {
            const newAttachments: StagedAttachment[] = results.map(file => ({
                type: 'image',
                uri: file.uri,
                name: file.name,
                mimeType: file.type
            }));
            setStagedAttachments(prev => [...prev, ...newAttachments]);
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setStagedAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleCopy = async (text: string) => { await Clipboard.setStringAsync(text); };
    const scrollToBottom = () => { flatListRef.current?.scrollToOffset({ offset: 0, animated: true }); };

    const handleFeedback = async (messageId: string, feedback: 'like' | 'dislike' | null) => {
        // Optimistic update
        updateMessage(messageId, { feedback });
        try {
            await chatService.sendFeedback(chatId, messageId, feedback);
        } catch (error) {
            console.error("Failed to send feedback", error);
            // Revert on error if needed, but low priority
        }
    };

    const handleRegenerate = async () => {
        await regenerateMessage(chatId);
    };

    const renderItem: ListRenderItem<Message> = React.useCallback(({ item, index }) => {
        return (
            <ChatMessageItem
                message={item}
                isLastMessage={index === 0}
                onCopy={handleCopy}
                onSuggestionPress={handleSend}
                onFeedback={handleFeedback}
                onRegenerate={handleRegenerate}
                themeColor={themeColor}
            />
        );
    }, [themeColor]);

    const keyExtractor = React.useCallback((item: Message) => item.localId || item.id.toString(), []);

    // Menu Actions Handler
    const handleMenuAction = async (action: string) => {
        if (action === 'manage_sources') {
            router.push({ pathname: '/chat/manage-sources', params: { chatId } });
        } else if (action === 'edit_bot') {
            router.push({ pathname: '/bots/create', params: { botId: botId as string } });
        } else if (action === 'history') {
            router.push({ pathname: '/chat/history', params: { botId: botId as string, currentChatId: chatId } });
        } else if (action === 'new_chat') {
            Alert.alert(
                "Novo Chat",
                "Deseja iniciar uma nova conversa? A conversa atual será salva no histórico.",
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Confirmar",
                        onPress: async () => {
                            try {
                                const { new_chat_id } = await chatService.archiveChat(chatId);
                                router.replace({
                                    pathname: `/chat/${new_chat_id}`,
                                    params: {
                                        botId,
                                        botName,
                                        botAvatar,
                                        suggestion1,
                                        suggestion2,
                                        suggestion3
                                    }
                                });
                            } catch (e) {
                                Alert.alert("Erro", "Falha ao criar novo chat.");
                            }
                        }
                    }
                ]
            );
        }
    };

    const getSuggestions = () => {
        const bot = currentChat?.bot;
        const suggestions = [];
        if (bot?.suggestion1) suggestions.push(bot.suggestion1);
        if (bot?.suggestion2) suggestions.push(bot.suggestion2);
        if (bot?.suggestion3) suggestions.push(bot.suggestion3);
        return suggestions;
    };

    // --- RENDER ---

    return (
        <SafeAreaView className="flex-1 bg-space-dark" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="flex-1 bg-space-dark">
                {/* Floating Header */}
                <FloatingTutorCard
                    botName={currentChat?.bot?.name || (botName as string) || 'Chat'}
                    botAvatar={currentChat?.bot?.avatar_url || (botAvatar as string)}
                    createdByMe={currentChat?.bot?.createdByMe}
                    animatedStyle={headerAnimatedStyle}
                    onNewChat={() => setIsKnowledgeSheetVisible(true)}
                    onMenu={handleMenuAction}
                />

                {/* Messages Area */}
                <View className="flex-1">
                    {isLoading && messages.length === 0 ? (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator color={themeColor} size="large" />
                        </View>
                    ) : (
                        <AnimatedFlatList
                            ref={flatListRef}
                            data={messages}
                            keyExtractor={keyExtractor}
                            renderItem={renderItem as any}
                            inverted
                            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 }}
                            onScroll={scrollHandler}
                            scrollEventThrottle={16}
                            onEndReached={() => loadMoreMessages(chatId)}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={
                                <ChatWelcome
                                    botAvatar={currentChat?.bot?.avatar_url || (botAvatar as string)}
                                    botName={currentChat?.bot?.name || (botName as string) || ''}
                                    description={currentChat?.bot?.description || ''}
                                    suggestions={getSuggestions()}
                                    onSuggestionPress={(text) => handleSend(text)}
                                    showSuggestions={messages.length === 0}
                                />
                            }
                        />
                    )}

                    {showScrollDown && (
                        <Pressable
                            onPress={scrollToBottom}
                            className="absolute bottom-4 right-4 bg-space-light p-3 rounded-full border border-white/10 shadow-lg"
                        >
                            <ChevronDown color={themeColor} size={24} />
                        </Pressable>
                    )}
                </View>

                {/* Input Area */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <View style={{ paddingBottom: miniPlayerHeight }}>
                        <ChatInput
                            value={inputText}
                            onChangeText={setInputText}
                            onSend={() => handleSend()}
                            onPlusPress={() => setIsAttachmentSheetVisible(true)}
                            onGalleryPress={() => handleDirectAttachment('image')}
                            onCameraPress={() => handleDirectAttachment('camera')}
                            onAudioRecorded={handleAudioRecorded}
                            disabled={isStreaming || isPickerLoading}
                            attachments={stagedAttachments}
                            onRemoveAttachment={handleRemoveAttachment}
                        />
                    </View>
                </KeyboardAvoidingView>
            </View>

            <AttachmentSheet
                visible={isAttachmentSheetVisible}
                onClose={() => setIsAttachmentSheetVisible(false)}
                onSelect={(file, type) => handleAddSource(file, type)}
            />

            {isKnowledgeSheetVisible && (
                <View className="absolute inset-0 z-50">
                    <Pressable className="absolute inset-0 bg-black/60" onPress={() => setIsKnowledgeSheetVisible(false)} />
                    <KnowledgeActionSheet onClose={() => setIsKnowledgeSheetVisible(false)} chatId={chatId} />
                </View>
            )}

            {isPickerLoading && (
                <View className="absolute inset-0 bg-black/50 justify-center items-center">
                    <ActivityIndicator size="large" color={themeColor} />
                </View>
            )}

        </SafeAreaView>
    );
}
