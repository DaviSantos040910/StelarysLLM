import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Copy, ThumbsUp, Volume2, RefreshCw } from 'lucide-react-native';
import { Message } from '../../types/chat';

interface ChatMessageItemProps {
  message: Message;
  isLastMessage: boolean;
  onCopy?: (text: string) => void;
  onLike?: (id: string) => void;
  onRetry?: (id: string) => void;
  onTTS?: (id: string, text: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
    message,
    isLastMessage,
    onCopy,
    onLike,
    onRetry,
    onTTS
}) => {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'sending' && !isUser;

  if (isUser) {
      return (
          <View className="flex-row justify-end mb-4">
              <View className="bg-cosmic-purple rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%]">
                  <Text className="text-white text-base leading-6">
                      {message.content}
                  </Text>
              </View>
          </View>
      );
  }

  // Bot Message
  return (
      <View className="flex-col mb-6">
          <View className="w-full pl-1 pr-4">
               {message.content ? (
                   <Text className="text-starlight text-base leading-7">
                       {message.content}
                   </Text>
               ) : (
                   isStreaming && <ActivityIndicator size="small" color="#818cf8" />
               )}
          </View>

          {/* Actions - Only show if content exists and not streaming (or maybe show during streaming? Usually after) */}
          {!isStreaming && message.content.length > 0 && (
              <View className="flex-row items-center mt-2 space-x-4 pl-1">
                  <Pressable onPress={() => onCopy?.(message.content)} className="p-2">
                      <Copy size={16} color="#94a3b8" />
                  </Pressable>
                  <Pressable onPress={() => onLike?.(message.id)} className="p-2">
                      <ThumbsUp size={16} color="#94a3b8" />
                  </Pressable>
                  <Pressable onPress={() => onTTS?.(message.id, message.content)} className="p-2">
                      <Volume2 size={16} color="#94a3b8" />
                  </Pressable>
                  <Pressable onPress={() => onRetry?.(message.id)} className="p-2">
                      <RefreshCw size={16} color="#94a3b8" />
                  </Pressable>
              </View>
          )}
      </View>
  );
};
