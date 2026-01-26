import client, { BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Message, ChatListItem, ChatSource } from '../types/chat'; // Ensure ChatSource is exported or defined here if not in types

// If ChatSource is not in types/chat.ts, define it here temporarily or import it if I missed it
// Based on previous read, it was defined in the service file.
export interface ChatSource {
    id: number;
    title: string; // mapped from 'name' or similar
    name?: string;
    type?: string;
    source_type?: 'FILE' | 'URL' | 'YOUTUBE' | 'kb';
    extracted_text?: string;
    created_at?: string;
    url?: string;
    selected?: boolean;
}

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

    const response = await client.post<Message[]>(`/api/v1/chats/${chatId}/voice-message/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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

    const response = await client.post(`/api/v1/chats/${chatId}/messages/attach/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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

  // Note: addChatSource/removeChatSource might need updates if backend API changed,
  // but keeping them as is for now unless specified otherwise in backend.
  // The provided backend code shows `ContextSourcesView` only for GET.
  // Creation seems to happen via `ChatMessageAttachmentView`.
  // I will comment these out if they are not supported or leave them if they use other endpoints.
  // The backend code provided DOES NOT have specific add/remove source endpoints in `chat/urls.py`
  // other than `attach/` for files.

  // addChatSource: ... (Keeping existing logic if it relies on other endpoints, but warning: Backend doesn't show explicit source management endpoints yet)

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
