import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Copy, ThumbsUp, Volume2, RefreshCw, FileText, BookOpen } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
  onSuggestionPress?: (text: string) => void;
  botName?: string;
  botAvatar?: string;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
    message,
    isLastMessage,
    onCopy,
    onLike,
    onRetry,
    onTTS,
    onSuggestionPress,
    botName,
    botAvatar
}) => {
  const router = useRouter();
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'sending' && !isUser;

  // Audio detection logic: Extension or MimeType
  const isAudio = (message.attachment_type?.startsWith('audio') ||
                   message.attachment_url?.endsWith('.m4a') ||
                   message.attachment_url?.endsWith('.mp3') ||
                   message.attachment_url?.endsWith('.wav') ||
                   message.attachment_url?.endsWith('.aac')) && !!message.attachment_url;

  const isImage = (message.attachment_type?.startsWith('image') ||
                   message.attachment_url?.match(/\.(jpeg|jpg|gif|png)$/) != null) && !!message.attachment_url;

  const handleOpenReader = () => {
    router.push({
        pathname: '/chat/reader',
        params: {
            content: message.content,
            botName,
            botAvatar
        }
    });
  };

  // Content rendering logic
  const renderContent = () => {
     // Audio
     if (isAudio && message.attachment_url) {
         return (
             <AudioMessagePlayer
                 uri={message.attachment_url}
                 duration={message.duration}
                 isUser={isUser}
             />
         );
     }

     // Image
     if (isImage && message.attachment_url) {
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
     if (message.attachment_url && !isImage && !isAudio) {
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
              <View className="flex-col pl-1 mt-2">
                  <View className="flex-row items-center space-x-4 mb-3">
                      {message.content?.length > 0 && (
                        <>
                            <Pressable onPress={() => onCopy?.(message.content)} className="p-2">
                                <Copy size={16} color="#94a3b8" />
                            </Pressable>

                            {/* Reader Mode Button */}
                            <Pressable onPress={handleOpenReader} className="p-2">
                                <BookOpen size={16} color="#94a3b8" />
                            </Pressable>
                        </>
                      )}

                      <Pressable onPress={() => onLike?.(message.id as string)} className="p-2">
                          <ThumbsUp size={16} color="#94a3b8" />
                      </Pressable>
                      {message.content?.length > 0 && (
                        <Pressable onPress={() => onTTS?.(message.id as string, message.content)} className="p-2">
                            <Volume2 size={16} color="#94a3b8" />
                        </Pressable>
                      )}
                      <Pressable onPress={() => onRetry?.(message.id as string)} className="p-2">
                          <RefreshCw size={16} color="#94a3b8" />
                      </Pressable>
                  </View>

                  {/* Suggestions Chips (Mini) */}
                  {isLastMessage && message.suggestions && message.suggestions.length > 0 && (
                      <View className="flex-row flex-wrap">
                          {message.suggestions.map((suggestion, idx) => (
                              <Pressable
                                key={idx}
                                onPress={() => onSuggestionPress?.(suggestion)}
                                className="mr-2 mb-2 px-3 py-1 rounded-full border border-white/10 bg-space-light/50 active:bg-space-light"
                              >
                                  <Text className="text-gray-300 text-xs">{suggestion}</Text>
                              </Pressable>
                          ))}
                      </View>
                  )}
              </View>
          )}
      </View>
  );
};
