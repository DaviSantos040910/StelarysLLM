import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';

import { useChatStore } from '../../src/stores/chatStore';
import { UserAvatar } from '../../src/components/UserAvatar';
import { ChatWelcome } from '../../src/components/chat/ChatWelcome';
import { ChatMessageItem } from '../../src/components/chat/ChatMessageItem';
import { ChatInput } from '../../src/components/chat/ChatInput';
import { AttachmentSheet } from '../../src/components/chat/AttachmentSheet';
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
  const [isAttachmentSheetVisible, setIsAttachmentSheetVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const { pickImage, pickDocument, takePhoto, isPickerLoading } = useAttachmentPicker();

  // Header Animation State
  const translateY = useSharedValue(0);
  const lastContentOffset = useSharedValue(0);
  const isHeaderVisible = useSharedValue(1); // 1 = visible, 0 = hidden

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

      // Update ScrollDown button visibility via JS callback
      runOnJS(handleScrollState)(currentOffset);

      // If scrolling down (diff > 0) and deeper than 50px, hide header
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

  const handleAttachmentOption = async (option: string) => {
      setIsAttachmentSheetVisible(false);

      let results;
      if (option === 'files') {
          results = await pickDocument();
      } else if (option === 'audio') {
          console.log("Audio option selected (Use mic input directly usually, but this is sheet)");
      } else if (option === 'website') {
          console.log("Website option selected");
      } else if (option === 'youtube') {
          console.log("YouTube option selected");
      }

      if (results) {
          for (const file of results) {
              await uploadFile(chatId, { uri: file.uri, name: file.name, mimeType: file.type || 'application/octet-stream' });
          }
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
  };

  // Wire handleAttachmentSelect for Gallery/Camera specifically from ChatInput icons (not sheet)
  const handleDirectAttachment = async (type: 'image' | 'camera') => {
      let results;
      if (type === 'image') results = await pickImage();
      else if (type === 'camera') results = await takePhoto();

      if (results) {
          for (const file of results) {
              await uploadFile(chatId, { uri: file.uri, name: file.name, mimeType: file.type || 'application/octet-stream' });
          }
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
  };

  const handleCopy = async (text: string) => { await Clipboard.setStringAsync(text); };

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
         onNewChat={() => {}}
         onMenu={() => {}}
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
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 }} // Fixed padding for inverted list
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
            onPlusPress={() => setIsAttachmentSheetVisible(true)}
            onGalleryPress={() => handleDirectAttachment('image')}
            onCameraPress={() => handleDirectAttachment('camera')}
            onAudioRecorded={handleAudioRecorded}
            disabled={isStreaming || isPickerLoading}
        />
      </KeyboardAvoidingView>

      <AttachmentSheet
          visible={isAttachmentSheetVisible}
          onClose={() => setIsAttachmentSheetVisible(false)}
          onSelectOption={handleAttachmentOption}
      />

      {isPickerLoading && (
          <View className="absolute inset-0 bg-black/50 justify-center items-center">
              <ActivityIndicator size="large" color="#818cf8" />
          </View>
      )}

    </SafeAreaView>
  );
}
