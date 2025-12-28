import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';

import { useChatStore } from '../../src/stores/chatStore';
import { UserAvatar } from '../../src/components/UserAvatar';
import { ChatWelcome } from '../../src/components/chat/ChatWelcome';
import { ChatMessageItem } from '../../src/components/chat/ChatMessageItem';
import { ChatInput } from '../../src/components/chat/ChatInput';
import { AttachmentMenu } from '../../src/components/chat/AttachmentMenu';
import { FloatingTutorCard } from '../../src/components/chat/FloatingTutorCard';
import { Message, ChatListItem, Bot } from '../../src/types/chat';
import { useAttachmentPicker } from '../../src/hooks/useAttachmentPicker';
import { botService } from '../../src/services/botService';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function ChatScreen() {
  const { id, botId, botName, botAvatar, suggestion1, suggestion2, suggestion3 } = useLocalSearchParams();
  const router = useRouter();
  const chatId = id as string;

  const { messages, loadMessages, sendMessage, isLoading, isStreaming, currentChat, loadMoreMessages, uploadFile, setCurrentChat } = useChatStore();
  const [inputText, setInputText] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isAttachmentMenuVisible, setIsAttachmentMenuVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const { pickImage, pickDocument, takePhoto, isPickerLoading } = useAttachmentPicker();

  // Header Animation State
  const translateY = useSharedValue(0);
  const lastContentOffset = useSharedValue(0);
  const isHeaderVisible = useSharedValue(1); // 1 = visible, 0 = hidden

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentOffset = event.contentOffset.y;
      const diff = currentOffset - lastContentOffset.value;

      // If scrolling down (diff > 0) and deeper than 50px, hide header
      // Note: FlatList inverted, so "down" visually is actually "up" in scroll offset if content grows?
      // Actually, inverted FlatList behaves: offset 0 is bottom. Increasing offset is scrolling up (into history).
      // So scrolling UP (to see history) increases offset.
      // Scrolling DOWN (to see recent) decreases offset.

      // Let's adhere to "Hide on scroll DOWN (visually moving content up), Show on scroll UP (visually moving content down)"
      // In Inverted list:
      // Dragging finger DOWN (scrolling UP visually to top of content) -> contentOffset decreases.
      // Dragging finger UP (scrolling DOWN visually to old history) -> contentOffset increases.

      // We want header to hide when we scroll DOWN into history (drag finger UP, offset increases).
      // We want header to show when we scroll UP to most recent (drag finger DOWN, offset decreases).

      if (diff > 10 && currentOffset > 50) {
        // Scrolling "down" into history (visually content moves up)
        isHeaderVisible.value = withTiming(0, { duration: 300 });
      } else if (diff < -10) {
        // Scrolling "up" (visually content moves down)
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
    if (!text.trim()) return;
    if (text === inputText) setInputText('');
    await sendMessage(chatId, text);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleAudioRecorded = async (uri: string, duration: number) => {
     const file = { uri, name: `audio_${Date.now()}.m4a`, mimeType: 'audio/m4a', duration };
     await uploadFile(chatId, file);
     flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleAttachmentSelect = async (type: 'image' | 'document' | 'camera') => {
      let results;
      if (type === 'image') results = await pickImage();
      else if (type === 'document') results = await pickDocument();
      else if (type === 'camera') results = await takePhoto();
      if (results) {
          for (const file of results) {
              await uploadFile(chatId, { uri: file.uri, name: file.name, mimeType: file.type || 'application/octet-stream' });
          }
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
  };

  const handleCopy = async (text: string) => { await Clipboard.setStringAsync(text); };

  const handleScroll = (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      setShowScrollDown(offsetY > 200);
  };

  const scrollToBottom = () => { flatListRef.current?.scrollToOffset({ offset: 0, animated: true }); };

  const renderItem = ({ item, index }: { item: Message, index: number }) => {
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
         onNewChat={() => {}} // TODO: Implement New Chat action
         onMenu={() => {}} // TODO: Implement Menu action
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
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={renderItem}
                inverted
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20, paddingTop: 100 }} // Extra padding for header
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
        <ChatInput
            value={inputText}
            onChangeText={setInputText}
            onSend={() => handleSend()}
            onPlusPress={() => setIsAttachmentMenuVisible(true)}
            onGalleryPress={() => handleAttachmentSelect('image')}
            onCameraPress={() => handleAttachmentSelect('camera')}
            onAudioRecorded={handleAudioRecorded}
            disabled={isStreaming || isPickerLoading}
        />
      </KeyboardAvoidingView>

      <AttachmentMenu
          visible={isAttachmentMenuVisible}
          onClose={() => setIsAttachmentMenuVisible(false)}
          onSelectImage={() => handleAttachmentSelect('image')}
          onSelectDocument={() => handleAttachmentSelect('document')}
          onTakePhoto={() => handleAttachmentSelect('camera')}
      />

      {isPickerLoading && (
          <View className="absolute inset-0 bg-black/50 justify-center items-center">
              <ActivityIndicator size="large" color="#818cf8" />
          </View>
      )}

    </SafeAreaView>
  );
}
