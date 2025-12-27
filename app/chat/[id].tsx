import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Paperclip } from 'lucide-react-native';
import { useChatStore } from '../../src/stores/chatStore';
import { UserAvatar } from '../../src/components/UserAvatar';
import { Message } from '../../src/types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const chatId = id as string;

  const { messages, loadMessages, sendMessage, isLoading, isStreaming } = useChatStore();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
    }
  }, [chatId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText(''); // Clear immediately
    await sendMessage(chatId, text);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View className={`flex-row my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
             <View className="mr-2">
                 {/* Bot Avatar - hardcoded or from store/params */}
                 <UserAvatar size={32} />
             </View>
        )}
        <View
            className={`max-w-[80%] p-3 rounded-2xl ${
                isUser ? 'bg-cosmic-purple rounded-tr-none' : 'bg-space-light rounded-tl-none border border-white/10'
            }`}
        >
            <Text className="text-starlight text-base">{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-space-dark" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-white/5 bg-space-dark/80 blur-md">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
           <ArrowLeft color="#fff" size={24} />
        </Pressable>
        <Text className="text-starlight text-lg font-bold flex-1">Chat</Text>
      </View>

      {/* Messages */}
      {isLoading ? (
          <View className="flex-1 justify-center items-center">
              <ActivityIndicator color="#818cf8" size="large" />
          </View>
      ) : (
          <FlatList
            ref={flatListRef}
            data={messages} // Check order. If store has newest first, use inverted.
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            inverted
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
          />
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
                onPress={handleSend}
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
