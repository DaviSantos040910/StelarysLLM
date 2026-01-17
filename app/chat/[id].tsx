import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, ListRenderItem, Platform, Pressable, View } from 'react-native';
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttachmentSheet } from '../../src/components/chat/AttachmentSheet';
import { ChatInput, StagedAttachment } from '../../src/components/chat/ChatInput'; // Import StagedAttachment
import { ChatMessageItem } from '../../src/components/chat/ChatMessageItem';
import { ChatWelcome } from '../../src/components/chat/ChatWelcome';
import { FloatingTutorCard } from '../../src/components/chat/FloatingTutorCard';
import { KnowledgeActionSheet } from '../../src/components/chat/KnowledgeActionSheet';
import { useAttachmentPicker } from '../../src/hooks/useAttachmentPicker';
import { useMiniPlayerHeight } from '../../src/hooks/useMiniPlayerHeight';
import { botService } from '../../src/services/botService';
import { useChatStore } from '../../src/stores/chatStore';
import { ChatListItem, Message } from '../../src/types/chat';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Message>);

export default function ChatScreen() {
    const { id, botId, botName, botAvatar, suggestion1, suggestion2, suggestion3 } = useLocalSearchParams();
    const router = useRouter();
    const chatId = id as string;

    const { messages, loadMessages, sendMessage, isLoading, isStreaming, currentChat, loadMoreMessages, uploadFile, setCurrentChat } = useChatStore();
    const [inputText, setInputText] = useState('');
    const [showScrollDown, setShowScrollDown] = useState(false);

    // Sheet Visibility States
    const [isAttachmentSheetVisible, setIsAttachmentSheetVisible] = useState(false);
    const [isKnowledgeSheetVisible, setIsKnowledgeSheetVisible] = useState(false);

    // Staged Attachments State
    const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

    const flatListRef = useRef<FlatList>(null);
    const { pickImage, pickDocument, takePhoto, isPickerLoading } = useAttachmentPicker();

    // Header Animation State
    const translateY = useSharedValue(0);
    const lastContentOffset = useSharedValue(0);
    const isHeaderVisible = useSharedValue(1);

    const miniPlayerHeight = useMiniPlayerHeight();

    const handleScrollState = (offset: number) => {
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

    const handleSend = async (text: string = inputText) => {
        if (!text.trim() && stagedAttachments.length === 0) return;

        // Clear input immediately
        if (text === inputText) {
            setInputText('');
            setStagedAttachments([]);
        }

        // Upload Staged Attachments first (Sequential for now)
        for (const att of stagedAttachments) {
            if (att.type === 'youtube') {
                // For youtube/links, we might just append to text or send as separate message
                // Currently backend uploadFile expects a file.
                // We'll append URL to text if it's a link, or if logic changes later.
                // For now, let's just append to text for simplicity if it's a link
                if (att.url) {
                    // If text is empty, send just the link. If text exists, append.
                    const linkMsg = `[YouTube](${att.url})`;
                    await sendMessage(chatId, linkMsg);
                }
            } else if (att.uri) {
                // File Upload
                await uploadFile(chatId, {
                    uri: att.uri,
                    name: att.name || 'file',
                    mimeType: att.mimeType || 'application/octet-stream'
                });
            }
        }

        // Send Text Message
        if (text.trim()) {
            await sendMessage(chatId, text);
        }

        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    const handleAudioRecorded = async (uri: string, duration: number) => {
        // Direct upload for audio recorder (UX decision: don't stage voice notes usually)
        const file = { uri, name: `audio_${Date.now()}.m4a`, mimeType: 'audio/m4a', duration };
        await uploadFile(chatId, file);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    // Sheet Option Handler
    const handleAttachmentOption = async (option: string, data?: any) => {
        setIsAttachmentSheetVisible(false);

        if (option === 'youtube' && data?.url) {
            setStagedAttachments(prev => [...prev, { type: 'youtube', url: data.url, name: 'YouTube Video' }]);
            return;
        }

        let results;
        if (option === 'files') {
            results = await pickDocument();
        } else if (option === 'audio') {
            // Maybe open recorder? Or pick audio file?
            // pickDocument handles audio mime types now too.
            results = await pickDocument(); // Reusing document picker for audio files
        }

        if (results) {
            const newAttachments: StagedAttachment[] = results.map(file => ({
                type: 'document',
                uri: file.uri,
                name: file.name,
                mimeType: file.type
            }));
            setStagedAttachments(prev => [...prev, ...newAttachments]);
        }
    };

    // Direct Icon Handlers
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

    const renderItem: ListRenderItem<Message> = ({ item, index }) => {
        return (
            <ChatMessageItem
                message={item}
                isLastMessage={index === 0}
                onCopy={handleCopy}
                onSuggestionPress={handleSend}
            />
        );
    };

    const getSuggestions = () => {
        const bot = currentChat?.bot;
        const suggestions = [];
        if (bot?.suggestion1) suggestions.push(bot.suggestion1);
        if (bot?.suggestion2) suggestions.push(bot.suggestion2);
        if (bot?.suggestion3) suggestions.push(bot.suggestion3);
        return suggestions;
    };

    return (
        <SafeAreaView className="flex-1 bg-space-dark" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Floating Header */}
            <FloatingTutorCard
                botName={currentChat?.bot?.name || (botName as string) || 'Chat'}
                botAvatar={currentChat?.bot?.avatar_url || (botAvatar as string)}
                animatedStyle={headerAnimatedStyle}
                onNewChat={() => setIsKnowledgeSheetVisible(true)}
                onMenu={() => { }}
            />

            {/* Messages Area */}
            {isLoading && messages.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="#818cf8" size="large" />
                </View>
            ) : messages.length === 0 ? (
                <View className="flex-1 pt-24">
                    <ChatWelcome
                        botAvatar={currentChat?.bot?.avatar_url || (botAvatar as string)}
                        botName={currentChat?.bot?.name || (botName as string) || ''}
                        description={currentChat?.bot?.description || ''}
                        suggestions={getSuggestions()}
                        onSuggestionPress={(text) => { setInputText(text); handleSend(text); }}
                    />
                </View>
            ) : (
                <View className="flex-1">
                    <AnimatedFlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => (item as Message).id.toString()}
                        renderItem={renderItem as any}
                        inverted
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 }}
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                        onEndReached={() => loadMoreMessages(chatId)}
                        onEndReachedThreshold={0.5}
                    />
                    {showScrollDown && (
                        <Pressable
                            onPress={scrollToBottom}
                            className="absolute bottom-4 right-4 bg-space-light p-3 rounded-full border border-white/10 shadow-lg"
                        >
                            <ChevronDown color="#818cf8" size={24} />
                        </Pressable>
                    )}
                </View>
            )}

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

            <AttachmentSheet
                visible={isAttachmentSheetVisible}
                onClose={() => setIsAttachmentSheetVisible(false)}
                onSelectOption={handleAttachmentOption}
            />

            {/* Render KnowledgeActionSheet when visible */}
            {isKnowledgeSheetVisible && (
                <View className="absolute inset-0 z-50">
                    <Pressable className="absolute inset-0 bg-black/60" onPress={() => setIsKnowledgeSheetVisible(false)} />
                    <KnowledgeActionSheet onClose={() => setIsKnowledgeSheetVisible(false)} chatId={chatId} />
                </View>
            )}

            {isPickerLoading && (
                <View className="absolute inset-0 bg-black/50 justify-center items-center">
                    <ActivityIndicator size="large" color="#818cf8" />
                </View>
            )}

        </SafeAreaView>
    );
}
