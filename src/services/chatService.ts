import client, { BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Message } from '../types';

export const chatService = {
  getMessages: async (chatId: string | number): Promise<Message[]> => {
    const response = await client.get<Message[]>(`/api/v1/chats/${chatId}/messages/`);
    return response.data;
  },

  uploadFile: async (chatId: string | number, file: any) => {
    const formData = new FormData();
    formData.append('attachment', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as any);
    // Backend expects 'content' field even if empty for attachment message
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
      // Use native fetch for streaming
      // Note: React Native fetch does not support streaming response body out of the box very well in all engines.
      // However, typical implementations use specific libraries like 'react-native-sse' or similar.
      // Or we can try standard fetch if the engine supports it (Hermes might).
      // Given the constraints, we will attempt a standard fetch and reading the response.
      // If true streaming isn't supported by the RN bridge for this, it might buffer.
      // But let's write the code for streaming.

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

      // Check if we can read the stream
      if (response.body) {
        // @ts-ignore
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // SSE format usually is "data: ...\n\n"
          // We need to parse this.
          const lines = chunk.split('\n');
          for (const line of lines) {
             if (line.startsWith('data: ')) {
               const data = line.slice(6);
               if (data === '[DONE]') {
                 break;
               }
               try {
                 // Try parsing as JSON if it's a JSON chunk or just raw text?
                 // The backend typically sends raw text chunks or JSONs.
                 // Looking at typical SSE, it might be JSON wrapped.
                 // Let's assume the backend sends JSON with a 'content' field or similar,
                 // OR just raw text.
                 // Wait, backend `StreamingHttpResponse` yields `process_message_stream`.
                 // We need to know what `process_message_stream` yields.
                 // Assuming it yields "data: { ... }\n\n"
                 const parsed = JSON.parse(data);
                 if (parsed.content) {
                    onChunk(parsed.content);
                 }
               } catch (e) {
                 // If not JSON, maybe just text?
                 // or partial JSON.
               }
             }
          }
        }
      } else {
        // Fallback for non-streaming environments or if fetch doesn't expose body reader (like legacy JSC)
        // We might just wait for full response.
        const text = await response.text();
        // Parse SSE manually from full text
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
