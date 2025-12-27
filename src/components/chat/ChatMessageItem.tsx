import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Copy, ThumbsUp, Volume2, RefreshCw, FileText } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Message } from '../../types/chat';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import * as Linking from 'expo-linking';

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

  // Content rendering logic
  const renderContent = () => {
     // Audio
     // Note: `attachment_type` might be 'audio' or 'audio/m4a' etc.
     if (message.attachment_type?.startsWith('audio') && message.attachment_url) {
         return (
             <AudioMessagePlayer
                 uri={message.attachment_url}
                 duration={message.duration}
                 isUser={isUser}
             />
         );
     }

     // Image
     if (message.attachment_type?.startsWith('image') && message.attachment_url) {
         return (
             <Pressable onPress={() => {/* TODO: Open Image Viewer */}}>
                <Image
                    source={{ uri: message.attachment_url }}
                    style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.1)' }}
                    contentFit="cover"
                />
             </Pressable>
         );
     }

     // File/Document
     if (message.attachment_url && !message.attachment_type?.startsWith('image') && !message.attachment_type?.startsWith('audio')) {
         return (
             <Pressable
                onPress={() => Linking.openURL(message.attachment_url!)}
                className={`flex-row items-center p-3 rounded-lg border ${
                    isUser ? 'bg-white/10 border-white/20' : 'bg-space-light border-white/10'
                }`}
             >
                 <View className={`p-2 rounded-full mr-3 ${isUser ? 'bg-white/20' : 'bg-space-dark'}`}>
                     <FileText size={20} color={isUser ? 'white' : '#94a3b8'} />
                 </View>
                 <View className="flex-1">
                     <Text className={`font-medium ${isUser ? 'text-white' : 'text-starlight'}`} numberOfLines={1}>
                         {message.original_filename || 'Document'}
                     </Text>
                     <Text className={`text-xs ${isUser ? 'text-white/70' : 'text-gray-500'}`}>
                         Attachment
                     </Text>
                 </View>
             </Pressable>
         );
     }

     // Text
     return (
        <Text className={`${isUser ? 'text-white' : 'text-starlight'} text-base leading-7`}>
            {message.content}
        </Text>
     );
  };

  if (isUser) {
      return (
          <View className="flex-row justify-end mb-4">
              <View className="bg-cosmic-purple rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%]">
                  {renderContent()}
              </View>
          </View>
      );
  }

  // Bot Message
  return (
      <View className="flex-col mb-6">
          <View className="w-full pl-1 pr-4">
               {message.content || message.attachment_url ? renderContent() : (
                   isStreaming && <ActivityIndicator size="small" color="#818cf8" />
               )}
          </View>

          {/* Actions */}
          {!isStreaming && (message.content?.length > 0 || message.attachment_url) && (
              <View className="flex-row items-center mt-2 space-x-4 pl-1">
                  {message.content?.length > 0 && (
                    <Pressable onPress={() => onCopy?.(message.content)} className="p-2">
                        <Copy size={16} color="#94a3b8" />
                    </Pressable>
                  )}
                  <Pressable onPress={() => onLike?.(message.id)} className="p-2">
                      <ThumbsUp size={16} color="#94a3b8" />
                  </Pressable>
                  {message.content?.length > 0 && (
                    <Pressable onPress={() => onTTS?.(message.id, message.content)} className="p-2">
                        <Volume2 size={16} color="#94a3b8" />
                    </Pressable>
                  )}
                  <Pressable onPress={() => onRetry?.(message.id)} className="p-2">
                      <RefreshCw size={16} color="#94a3b8" />
                  </Pressable>
              </View>
          )}
      </View>
  );
};
