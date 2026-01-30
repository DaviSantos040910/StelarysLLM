import client, { BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Message, ChatListItem, ChatSource } from '../types/chat';

interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export const chatService = {
  getMessages: async (chatId: string | number): Promise<Message[]> => {
    const response = await client.get<PaginatedResponse<Message>>(`/api/v1/chats/${chatId}/messages/`);
    // Handle both array and paginated response for safety
    if (Array.isArray(response.data)) {
        return response.data;
    }
    return response.data.results || [];
  },

  getChatDetails: async (chatId: string | number): Promise<ChatListItem> => {
    const response = await client.get<ChatListItem>(`/api/v1/chats/${chatId}/`);
    return response.data;
  },

  sendVoiceMessage: async (chatId: string | number, file: any): Promise<Message[]> => {
    const formData = new FormData();
    formData.append('audio', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'audio/m4a',
    } as any);

    if (file.duration) {
        formData.append('duration', String(file.duration));
    }
    formData.append('reply_with_audio', 'false');

    // Explicitly unset Content-Type to allow boundary generation
    const response = await client.post<Message[]>(`/api/v1/chats/${chatId}/voice-message/`, formData, {
        headers: { 'Content-Type': undefined },
        transformRequest: (data) => data
    });
    return response.data;
  },

  uploadFile: async (chatId: string | number, file: any) => {
    const formData = new FormData();
    formData.append('attachment', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as any);
    formData.append('content', '');

    // Explicitly unset Content-Type to allow boundary generation
    const response = await client.post(`/api/v1/chats/${chatId}/messages/attach/`, formData, {
        headers: { 'Content-Type': undefined },
        transformRequest: (data) => data
    });
    return response.data;
  },

  // === New Features: Feedback & Regenerate ===

  sendFeedback: async (chatId: string | number, messageId: string, feedback: 'like' | 'dislike' | null): Promise<{ feedback: string | null }> => {
      const response = await client.post<{ feedback: string | null }>(`/api/v1/chats/${chatId}/messages/${messageId}/feedback/`, { feedback });
      return response.data;
  },

  regenerateMessage: async (chatId: string | number): Promise<Message[]> => {
      const response = await client.post<Message[]>(`/api/v1/chats/${chatId}/regenerate/`, {});
      return response.data;
  },

  // === Chat Source Management ===

  getChatSources: async (chatId: string): Promise<ChatSource[]> => {
    const response = await client.get<ChatSource[]>(`/api/v1/chats/${chatId}/context-sources/`);
    return response.data;
  },

  addChatSource: async (chatId: string, fileOrUrl: any, type: 'FILE' | 'URL' | 'YOUTUBE'): Promise<ChatSource> => {
      const formData = new FormData();

      formData.append('title', fileOrUrl.name || 'Nova Fonte');
      formData.append('source_type', type);

      if (type === 'FILE') {
          formData.append('file', {
              uri: fileOrUrl.uri,
              name: fileOrUrl.name,
              type: fileOrUrl.mimeType || 'application/octet-stream',
          } as any);
      } else {
          formData.append('url', fileOrUrl.uri || fileOrUrl);
          if (!fileOrUrl.name) formData.append('title', fileOrUrl.uri || fileOrUrl);
      }

      // Explicitly unset Content-Type to allow boundary generation
      const response = await client.post<ChatSource>(`/api/v1/chats/${chatId}/sources/`, formData, {
          headers: { 'Content-Type': undefined },
          transformRequest: (data) => data
      });
      return response.data;
  },

  removeChatSource: async (chatId: string, sourceId: number): Promise<void> => {
      await client.delete(`/api/v1/chats/${chatId}/sources/${sourceId}/`);
  },

  // === TTS ===
  getMessageTTS: async (chatId: string | number, messageId: string): Promise<string> => {
      // Return full URL for AudioPlayerStore to consume with headers
      return `${BASE_URL}/api/v1/chats/${chatId}/messages/${messageId}/tts/`;
  },

  // === Chat Management & History ===

  archiveChat: async (chatId: string): Promise<{ new_chat_id: number }> => {
      const response = await client.post<{ new_chat_id: number }>(`/api/v1/chats/${chatId}/archive/`);
      return response.data;
  },

  setActiveChat: async (chatId: string): Promise<ChatListItem> => {
      const response = await client.post<ChatListItem>(`/api/v1/chats/${chatId}/set-active/`);
      return response.data;
  },

  getArchivedChats: async (botId: string): Promise<ChatListItem[]> => {
      const response = await client.get<ChatListItem[]>(`/api/v1/chats/archived/bot/${botId}/`);
      return response.data;
  },

  sendMessageStream: async (
    chatId: string | number,
    content: string,
    onChunk: (text: string) => void,
    onError: (error: any) => void,
    onComplete: () => void
  ) => {
    const token = useAuthStore.getState().token;

    try {
      const response = await fetch(`${BASE_URL}/api/v1/chats/${chatId}/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
        // @ts-ignore
        reactNative: { textStreaming: true },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // @ts-ignore
      if (response.body && response.body.getReader) {
        // @ts-ignore
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
             if (line.startsWith('data: ')) {
               const data = line.slice(6);
               if (data === '[DONE]') break;
               try {
                 const parsed = JSON.parse(data);
                 if (parsed.type === 'chunk' && parsed.text) {
                     onChunk(parsed.text);
                 } else if (parsed.content) {
                     onChunk(parsed.content);
                 }
               } catch (e) {}
             }
          }
        }
      } else {
        const text = await response.text();
         const lines = text.split('\n');
          for (const line of lines) {
             if (line.startsWith('data: ')) {
               const data = line.slice(6);
               if (data !== '[DONE]') {
                 try {
                   const parsed = JSON.parse(data);
                   if (parsed.type === 'chunk' && parsed.text) {
                       onChunk(parsed.text);
                   } else if (parsed.content) {
                       onChunk(parsed.content);
                   }
                 } catch (e) {}
               }
             }
          }
      }
      onComplete();

    } catch (error) {
      onError(error);
    }
  }
};
