import { create } from 'zustand';
import { Message, ChatListItem } from '../types/chat'; // Assuming ChatListItem is here or in types/chat
import { chatService } from '../services/chatService';

interface ChatState {
  messages: Message[];
  currentChat: ChatListItem | null; // For header/welcome details
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;

  loadMessages: (chatId: string | number) => Promise<void>;
  sendMessage: (chatId: string | number, text: string) => Promise<void>;
  addMessage: (message: Message) => void;
  uploadFile: (chatId: string | number, file: any) => Promise<void>;
  loadChatDetails: (chatId: string | number) => Promise<void>; // New action
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentChat: null,
  isLoading: false,
  isStreaming: false,
  error: null,

  loadMessages: async (chatId) => {
    set({ isLoading: true, error: null });
    try {
      const messages = await chatService.getMessages(chatId);
      set({ messages, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load messages', isLoading: false });
    }
  },

  loadChatDetails: async (chatId) => {
    try {
      const chat = await chatService.getChatDetails(chatId);
      set({ currentChat: chat });
    } catch (error) {
       console.error("Failed to load chat details", error);
       // Optional: set error state
    }
  },

  addMessage: (message) => {
    set((state) => ({ messages: [message, ...state.messages] }));
  },

  sendMessage: async (chatId, text) => {
    // 1. Optimistic update: Add User Message
    const userMsg: Message = {
      id: Date.now().toString(), // temp id
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [userMsg, ...state.messages],
      isStreaming: true
    }));

    // 2. Placeholder for AI Message
    const aiMsgId = (Date.now() + 1).toString();
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    set((state) => ({ messages: [aiMsg, ...state.messages] }));

    // 3. Call Stream
    await chatService.sendMessageStream(
      chatId,
      text,
      (chunk) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === aiMsgId ? { ...m, content: m.content + chunk } : m
          )
        }));
      },
      (error) => {
        set({ error: 'Failed to send message', isStreaming: false });
      },
      () => {
        set({ isStreaming: false });
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
