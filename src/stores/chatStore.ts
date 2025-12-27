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
  loadChatDetails: (chatId: string | number) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentChat: null,
  isLoading: false,
  isStreaming: false,
  error: null,
  hasMore: true,
  page: 1,

  loadMessages: async (chatId) => {
    set({ isLoading: true, error: null, page: 1, hasMore: true });
    try {
      // Assuming getMessages supports pagination or we fetch initial batch
      // For now, let's assume it returns the latest messages.
      // Ideally backend returns { results: [], next: ... }
      // We need to adjust chatService.getMessages to return full paginated response to handle hasMore properly.
      // But for now, let's keep it simple as per previous step, but we might need to refactor chatService slightly.
      const messages = await chatService.getMessages(chatId);
      set({ messages, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load messages', isLoading: false });
    }
  },

  loadMoreMessages: async (chatId) => {
      const { hasMore, page, isLoading } = get();
      if (!hasMore || isLoading) return;

      set({ isLoading: true });
      try {
          // We need a paginated endpoint.
          // Since chatService.getMessages currently returns Message[], we need to enhance it.
          // Let's assume for now we don't implement pagination fully until chatService is updated.
          // Just a placeholder.
          // const newMessages = await chatService.getMessages(chatId, page + 1);
          // set({ messages: [...get().messages, ...newMessages], page: page + 1, isLoading: false });
          set({ isLoading: false });
      } catch (e) {
          set({ isLoading: false });
      }
  },

  loadChatDetails: async (chatId) => {
    try {
      const chat = await chatService.getChatDetails(chatId);
      set({ currentChat: chat });
    } catch (error) {
       console.error("Failed to load chat details", error);
    }
  },

  addMessage: (message) => {
    set((state) => ({ messages: [message, ...state.messages] }));
  },

  sendMessage: async (chatId, text) => {
    // 1. Optimistic update: Add User Message
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    set((state) => ({
      messages: [userMsg, ...state.messages],
      isStreaming: true
    }));

    // 2. Placeholder for AI Message
    const aiMsgId = `temp-stream-${Date.now()}`;
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    set((state) => ({ messages: [aiMsg, ...state.messages] }));

    // 3. Call Stream
    await streamMessage(
      chatId,
      text,
      {
          onStart: (meta) => {
              // Optionally update temp IDs with real IDs if provided
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
                    m.id === aiMsgId ? { ...m, status: 'sent', id: meta.message_id || m.id } :
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
       const response = await chatService.uploadFile(chatId, file);
       if (Array.isArray(response)) {
          set((state) => ({ messages: [...response.reverse(), ...state.messages] }));
       }
     } catch (e) {
       console.error(e);
     } finally {
       set({ isStreaming: false });
     }
  }
}));
