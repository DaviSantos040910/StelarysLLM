import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Pressable, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Paperclip, ChevronDown } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useChatStore } from '../../src/stores/chatStore';
import { UserAvatar } from '../../src/components/UserAvatar';
import { ChatWelcome } from '../../src/components/chat/ChatWelcome';
import { ChatMessageItem } from '../../src/components/chat/ChatMessageItem';
import { Message } from '../../src/types/chat';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const chatId = id as string;

  const { messages, loadMessages, sendMessage, isLoading, isStreaming, loadChatDetails, currentChat, loadMoreMessages } = useChatStore();
  const [inputText, setInputText] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
      loadChatDetails(chatId);
    }
  }, [chatId]);

  const handleSend = async (text: string = inputText) => {
    if (!text.trim()) return;
    if (text === inputText) setInputText('');
    await sendMessage(chatId, text);
    // Scroll to bottom is handled automatically by inverted list when new item is added to top (data[0])
    // But we might want to ensure it snaps.
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleCopy = async (text: string) => {
      await Clipboard.setStringAsync(text);
      // Optional: Show toast
  };

  const handleScroll = (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      // Inverted list: offsetY increases as we scroll UP (back in time).
      // 0 is the bottom (most recent).
      if (offsetY > 200) {
          setShowScrollDown(true);
      } else {
          setShowScrollDown(false);
      }
  };

  const scrollToBottom = () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderItem = ({ item, index }: { item: Message, index: number }) => {
    return (
        <ChatMessageItem
            message={item}
            isLastMessage={index === 0}
            onCopy={handleCopy}
            // onLike, onRetry, onTTS can be implemented later or connected to store actions
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
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-white/5 bg-space-dark/80 blur-md">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
           <ArrowLeft color="#fff" size={24} />
        </Pressable>
        <UserAvatar imageUri={currentChat?.bot?.avatar_url} size={32} className="mr-3" />
        <View className="flex-1">
             <Text className="text-starlight text-lg font-bold">
                {currentChat?.bot?.name || 'Chat'}
            </Text>
            {/* Online/Status indicator if needed */}
        </View>
      </View>

      {/* Messages Area */}
      {isLoading && messages.length === 0 ? (
          <View className="flex-1 justify-center items-center">
              <ActivityIndicator color="#818cf8" size="large" />
          </View>
      ) : messages.length === 0 && currentChat ? (
          <ChatWelcome
             botAvatar={currentChat.bot.avatar_url}
             botName={currentChat.bot.name}
             description={currentChat.bot.description}
             suggestions={getSuggestions()}
             onSuggestionPress={handleSend}
          />
      ) : (
          <View className="flex-1">
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                inverted
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onEndReached={() => loadMoreMessages(chatId)}
                onEndReachedThreshold={0.5}
            />
            {/* Scroll Down FAB */}
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
        <View className="flex-row items-center p-3 bg-space-light border-t border-white/10">
           <Pressable className="p-2">
               <Paperclip color="#94a3b8" size={24} />
           </Pressable>
           <TextInput
             className="flex-1 bg-space-dark text-starlight rounded-full px-4 py-3 mx-2 border border-white/10"
             placeholder="Type a message..."
             placeholderTextColor="#64748b"
             value={inputText}
             onChangeText={setInputText}
             multiline
           />
           <Pressable
                onPress={() => handleSend()}
                disabled={!inputText.trim() || isStreaming}
                className={`p-3 rounded-full ${inputText.trim() ? 'bg-cosmic-purple' : 'bg-gray-700'}`}
           >
               <Send color="white" size={20} />
           </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
