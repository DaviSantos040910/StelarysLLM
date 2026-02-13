import apiClient, { BASE_URL } from '../api/client';
import { getAuthHeaders } from '../api/authHeaders';
import { Message, ChatListItem, ChatSource } from '../types/chat';

interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export const chatService = {
  getMessages: async (chatId: string | number): Promise<Message[]> => {
    const response = await apiClient.get<PaginatedResponse<Message>>(`/api/v1/chats/${chatId}/messages/`);
    if (Array.isArray(response.data)) {
        return response.data;
    }
    return response.data.results || [];
  },

  getChatDetails: async (chatId: string | number): Promise<ChatListItem> => {
    const response = await apiClient.get<ChatListItem>(`/api/v1/chats/${chatId}/`);
    return response.data;
  },

  sendVoiceMessage: async (chatId: string | number, file: any): Promise<Message[]> => {
    const formData = new FormData();
    formData.append('audio', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || file.type || 'audio/m4a',
    } as any);

    if (file.duration) {
        formData.append('duration', String(file.duration));
    }
    formData.append('reply_with_audio', 'false');

    const headers = getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/v1/chats/${chatId}/voice-message/`, {
        method: 'POST',
        headers,
        body: formData as any,
    });

    if (!response.ok) throw new Error('Failed to send voice message');
    return await response.json();
  },

  uploadFile: async (chatId: string | number, file: any) => {
    const formData = new FormData();
    formData.append('attachment', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || file.type || 'application/octet-stream',
    } as any);
    formData.append('content', '');

    const headers = getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/v1/chats/${chatId}/messages/attach/`, {
        method: 'POST',
        headers,
        body: formData as any,
    });

    if (!response.ok) throw new Error('Failed to upload file');
    return await response.json();
  },

  // === New Features: Feedback & Regenerate ===

  sendFeedback: async (chatId: string | number, messageId: string, feedback: 'like' | 'dislike' | null): Promise<{ feedback: string | null }> => {
      const response = await apiClient.post<{ feedback: string | null }>(`/api/v1/chats/${chatId}/messages/${messageId}/feedback/`, { feedback });
      return response.data;
  },

  regenerateMessage: async (chatId: string | number): Promise<Message[]> => {
      const response = await apiClient.post<Message[]>(`/api/v1/chats/${chatId}/regenerate/`, {});
      return response.data;
  },

  // === Chat Source Management ===

  getChatSources: async (chatId: string): Promise<ChatSource[]> => {
    const response = await apiClient.get<ChatSource[]>(`/api/v1/chats/${chatId}/context-sources/`);
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
              type: fileOrUrl.mimeType || fileOrUrl.type || 'application/octet-stream',
          } as any);
      } else {
          formData.append('url', fileOrUrl.uri || fileOrUrl);
          if (!fileOrUrl.name) formData.append('title', fileOrUrl.uri || fileOrUrl);
      }

      const headers = getAuthHeaders();
      const response = await fetch(`${BASE_URL}/api/v1/chats/${chatId}/sources/`, {
          method: 'POST',
          headers,
          body: formData as any,
      });

      if (!response.ok) throw new Error('Failed to add chat source');
      return await response.json();
  },

  removeChatSource: async (chatId: string, sourceId: number): Promise<void> => {
      await apiClient.delete(`/api/v1/chats/${chatId}/sources/${sourceId}/`);
  },

  // === TTS ===
  getMessageTTS: async (chatId: string | number, messageId: string): Promise<string> => {
      return `${BASE_URL}/api/v1/chats/${chatId}/messages/${messageId}/tts/`;
  },

  // === Chat Management & History ===

  archiveChat: async (chatId: string): Promise<{ new_chat_id: number }> => {
      const response = await apiClient.post<{ new_chat_id: number }>(`/api/v1/chats/${chatId}/archive/`);
      return response.data;
  },

  setActiveChat: async (chatId: string): Promise<ChatListItem> => {
      const response = await apiClient.post<ChatListItem>(`/api/v1/chats/${chatId}/set-active/`);
      return response.data;
  },

  getArchivedChats: async (botId: string): Promise<ChatListItem[]> => {
      const response = await apiClient.get<ChatListItem[]>(`/api/v1/chats/archived/bot/${botId}/`);
      return response.data;
  },

  sendMessageStream: async (
    chatId: string | number,
    content: string,
    onChunk: (text: string) => void,
    onError: (error: any) => void,
    onComplete: () => void
  ) => {
    const headers = getAuthHeaders({ 'Content-Type': 'application/json' });

    try {
      const response = await fetch(`${BASE_URL}/api/v1/chats/${chatId}/stream/`, {
        method: 'POST',
        headers,
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
                 // Defensive check for message_id == 0
                 if (parsed.message_id === 0 || parsed.message_id === '0') {
                     console.error("Critical: Received invalid message_id=0 from backend stream.");
                     // Do not propagate this ID to avoid corrupting local state
                     // We continue processing chunks but filter out the ID update if present
                     delete parsed.message_id;
                 }

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
                   // Defensive check for message_id == 0
                   if (parsed.message_id === 0 || parsed.message_id === '0') {
                       console.error("Critical: Received invalid message_id=0 from backend stream.");
                       delete parsed.message_id;
                   }

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
