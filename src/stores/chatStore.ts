import { create } from 'zustand';
import { Message, ChatListItem } from '../types/chat';
import { chatService } from '../services/chatService';
import { streamMessage, StreamMetadata } from '../services/streamApi';

interface ChatState {
  messages: Message[];
  currentChat: ChatListItem | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;

  loadMessages: (chatId: string | number) => Promise<void>;
  loadMoreMessages: (chatId: string | number) => Promise<void>;
  sendMessage: (chatId: string | number, text: string) => Promise<void>;
  addMessage: (message: Message) => void;
  uploadFile: (chatId: string | number, file: any) => Promise<void>;
  setCurrentChat: (chat: ChatListItem) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentChat: null,
  isLoading: false,
  isStreaming: false,
  error: null,
  hasMore: true,
  page: 1,

  setCurrentChat: (chat) => set({ currentChat: chat }),

  loadMessages: async (chatId) => {
    set({ isLoading: true, error: null, page: 1, hasMore: true });
    try {
      const messages = await chatService.getMessages(chatId);
      set({ messages: Array.isArray(messages) ? messages : [], isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load messages', isLoading: false });
    }
  },

  loadMoreMessages: async (chatId) => {
      const { hasMore, page, isLoading } = get();
      if (!hasMore || isLoading) return;

      set({ isLoading: true });
      try {
          set({ isLoading: false });
      } catch (e) {
          set({ isLoading: false });
      }
  },

  addMessage: (message) => {
    const currentMessages = get().messages || [];
    set({ messages: [message, ...currentMessages] });
  },

  sendMessage: async (chatId, text) => {
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    const currentMessages = get().messages || [];

    set({
      messages: [userMsg, ...currentMessages],
      isStreaming: true
    });

    const aiMsgId = `temp-stream-${Date.now()}`;
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    set((state) => ({ messages: [aiMsg, ...state.messages] }));

    await streamMessage(
      chatId,
      text,
      {
          onStart: (meta) => {
          },
          onChunk: (chunk) => {
            set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === aiMsgId ? { ...m, content: m.content + chunk } : m
                )
            }));
          },
          onFinish: (meta) => {
             set((state) => ({
                isStreaming: false,
                messages: state.messages.map((m) =>
                    m.id === aiMsgId ? {
                        ...m,
                        status: 'sent',
                        id: meta.message_id || m.id,
                        suggestions: meta.suggestions || m.suggestions
                    } :
                    m.id === userMsg.id ? { ...m, status: 'sent', id: meta.user_message_id || m.id } : m
                )
             }));
          },
          onError: (err) => {
              set({ error: 'Failed to send message', isStreaming: false });
              set((state) => ({
                  messages: state.messages.map(m => m.id === userMsg.id || m.id === aiMsgId ? { ...m, status: 'error' } : m)
              }));
          }
      }
    );
  },

  uploadFile: async (chatId, file) => {
     set({ isStreaming: true });
     try {
       let response;
       const isAudio = file.type?.startsWith('audio/') || file.mimeType?.startsWith('audio/');

       if (isAudio) {
           response = await chatService.sendVoiceMessage(chatId, file);
       } else {
           response = await chatService.uploadFile(chatId, file);
       }

       const currentMessages = get().messages || [];

       if (Array.isArray(response)) {
          // If response is array (like from voice-message), it contains [userMsg, aiMsg]
          // We need to merge them correctly.
          // Usually responses are sorted by created_at.
          // Assuming response has newest first? Or list?
          // If we receive a list of new messages, we prepend them.
          set({ messages: [...response.reverse(), ...currentMessages] });
       }
     } catch (e) {
       console.error(e);
     } finally {
       set({ isStreaming: false });
     }
  }
}));
