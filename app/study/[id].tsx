import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Mic, Paperclip, Send } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '../../src/stores/chatStore';
import { Message } from '../../src/types';

function MessageBubble({ item }: { item: Message }) {
  const isUser = item.role === 'user';

  return (
    <View className={`my-2 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[85%] rounded-2xl p-4 ${isUser ? 'bg-blue-600 rounded-tr-sm' : 'bg-gray-100 rounded-tl-sm'
          }`}
      >
        {isUser ? (
          <Text className="text-white text-base leading-6">{item.content}</Text>
        ) : (
          <Markdown style={{
            body: { color: '#1f2937', fontSize: 16, lineHeight: 24 },
            code_inline: { backgroundColor: '#e5e7eb', borderRadius: 4, padding: 2 },
            fence: { backgroundColor: '#e5e7eb', borderRadius: 8, padding: 8 }
          }}>
            {item.content}
          </Markdown>
        )}

        {/* Attachment Indicator */}
        {item.attachment && (
          <View className="mt-2 bg-black/10 p-2 rounded flex-row items-center">
            <Paperclip size={14} color={isUser ? "white" : "black"} />
            <Text className={`text-xs ml-1 ${isUser ? "text-white" : "text-black"}`}>
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
    // const { status } = await Audio.requestPermissionsAsync();
    // if (status !== 'granted') return;
    // ... logic to record and upload
    alert('Audio recording coming soon');
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
          <ArrowLeft color="#374151" size={24} />
        </TouchableOpacity>
        <View>
          <Text className="font-bold text-lg text-gray-900">Study Session</Text>
          <Text className="text-gray-500 text-xs">Chat ID: {id}</Text>
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        data={messages}
        renderItem={({ item }) => <MessageBubble item={item} />}
        keyExtractor={(item) => item.id.toString()}
        inverted
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
        className="flex-1 bg-white"
        ListFooterComponent={
          isStreaming && !messages.some(m => m.id === 'temp-ai') ? (
            <View className="py-2"><Text className="text-gray-400 text-xs text-center">AI is thinking...</Text></View>
          ) : null
        }
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View className="flex-row items-end p-3 border-t border-gray-100 bg-white">
          <TouchableOpacity onPress={handlePickFile} className="p-3">
            <Paperclip color="#6b7280" size={22} />
          </TouchableOpacity>

          <View className="flex-1 bg-gray-100 rounded-2xl min-h-[44px] px-4 py-2 mx-1 justify-center">
            <TextInput
              className="text-base text-gray-900 leading-5"
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
