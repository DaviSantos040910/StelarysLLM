import client, { BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Message, ChatListItem } from '../types/chat';

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
    // Endpoint might not exist, handled by caller or store
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
    formData.append('reply_with_audio', 'false'); // Or true if TTS enabled in future

    // This endpoint returns [UserMessage, AiMessage]
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
        // @ts-ignore - react-native specific
        reactNative: { textStreaming: true },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (response.body) {
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
                 if (parsed.content) onChunk(parsed.content);
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
                   if (parsed.content) onChunk(parsed.content);
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
