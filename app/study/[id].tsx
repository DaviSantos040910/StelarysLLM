import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '../../src/stores/chatStore';
import { Message } from '../../src/types';
import Markdown from 'react-native-markdown-display';
import { Send, Paperclip, Mic, ArrowLeft } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { themeClasses } from '../../src/theme/classes';
import { useColorScheme } from 'nativewind';

function MessageBubble({ item }: { item: Message }) {
  const isUser = item.role === 'user';
  const { colorScheme } = useColorScheme();

  return (
    <View className={`my-2 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[85%] rounded-2xl p-4 ${
          isUser ? 'bg-blue-600 rounded-tr-sm' : `${themeClasses.softSurface} rounded-tl-sm`
        }`}
      >
        {isUser ? (
          <Text className="text-white text-base leading-6">{item.content}</Text>
        ) : (
          <Markdown style={{
             body: { color: colorScheme === 'dark' ? '#f8fafc' : '#1f2937', fontSize: 16, lineHeight: 24 },
             code_inline: { backgroundColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb', borderRadius: 4, padding: 2, color: colorScheme === 'dark' ? '#f8fafc' : '#1f2937' },
             fence: { backgroundColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb', borderRadius: 8, padding: 8, color: colorScheme === 'dark' ? '#f8fafc' : '#1f2937' }
          }}>
            {item.content}
          </Markdown>
        )}

        {/* Attachment Indicator */}
        {item.attachment && (
           <View className={`mt-2 p-2 rounded flex-row items-center ${isUser ? 'bg-black/10' : 'bg-black/5 dark:bg-white/10'}`}>
             <Paperclip size={14} color={isUser ? "white" : (colorScheme === 'dark' ? '#94a3b8' : 'black')} />
             <Text className={`text-xs ml-1 ${isUser ? "text-white" : themeClasses.textSecondary}`}>
               {item.attachment.split('/').pop()}
             </Text>
           </View>
        )}
      </View>
    </View>
  );
}

export default function StudyChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { messages, loadMessages, sendMessage, uploadFile, isLoading, isStreaming } = useChatStore();
  const [inputText, setInputText] = useState('');
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    if (id) {
      loadMessages(id as string);
    }
  }, [id]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await sendMessage(id as string, text);
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadFile(id as string, result.assets[0]);
      }
    } catch (err) {
      console.log('Pick error', err);
    }
  };

  const handleRecordAudio = async () => {
    // Placeholder for audio recording logic
    alert('Audio recording coming soon');
  };

  return (
    <SafeAreaView className={themeClasses.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className={`flex-row items-center p-4 ${themeClasses.headerBorder}`}>
        <TouchableOpacity onPress={() => router.back()} className={`p-2 mr-2 rounded-full ${themeClasses.press}`}>
          <ArrowLeft color={colorScheme === 'dark' ? '#f8fafc' : '#111827'} size={24} />
        </TouchableOpacity>
        <View>
           <Text className={`font-bold text-lg ${themeClasses.textPrimary}`}>Study Session</Text>
           <Text className={`${themeClasses.textMuted} text-xs`}>Chat ID: {id}</Text>
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        data={messages}
        renderItem={({ item }) => <MessageBubble item={item} />}
        keyExtractor={(item) => item.id.toString()}
        inverted
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
        className="flex-1"
        ListFooterComponent={
           isStreaming && !messages.some(m => m.id === 'temp-ai') ? (
             <View className="py-2"><Text className={`${themeClasses.textMuted} text-xs text-center`}>AI is thinking...</Text></View>
           ) : null
        }
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View className={`flex-row items-end p-3 ${themeClasses.headerBorder} border-t ${themeClasses.surface}`}>
          <TouchableOpacity onPress={handlePickFile} className="p-3">
            <Paperclip color="#6b7280" size={22} />
          </TouchableOpacity>

          <View className={`flex-1 ${themeClasses.input} rounded-2xl min-h-[44px] px-4 py-2 mx-1 justify-center`}>
            <TextInput
              className={`${themeClasses.textPrimary} text-base leading-5`}
              placeholder="Ask anything..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={1000}
              value={inputText}
              onChangeText={setInputText}
            />
          </View>

          {inputText.trim() ? (
             <TouchableOpacity
               onPress={handleSend}
               className="p-3 bg-blue-600 rounded-full ml-1 items-center justify-center"
               disabled={isStreaming}
             >
               <Send color="white" size={20} />
             </TouchableOpacity>
          ) : (
             <TouchableOpacity onPress={handleRecordAudio} className="p-3 ml-1">
               <Mic color="#6b7280" size={22} />
             </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
