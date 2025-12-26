import { create } from 'zustand';
import { Message } from '../types';
import { chatService } from '../services/chatService';

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;

  loadMessages: (chatId: string | number) => Promise<void>;
  sendMessage: (chatId: string | number, text: string) => Promise<void>;
  addMessage: (message: Message) => void;
  uploadFile: (chatId: string | number, file: any) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,

  loadMessages: async (chatId) => {
    set({ isLoading: true, error: null });
    try {
      const messages = await chatService.getMessages(chatId);
      // Reverse to show latest at bottom if using inverted FlatList,
      // OR keep as is if using standard.
      // Usually backend returns ordered by -created_at (newest first).
      // We often want newest at bottom, so we might reverse them for display
      // if using flex-col-reverse or inverted list.
      // Let's store them as received (newest first) and handle display in UI.
      set({ messages, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load messages', isLoading: false });
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
        // Remove placeholder? Or show error state on message?
      },
      () => {
        set({ isStreaming: false });
        // Optionally reload messages to get real IDs and full state
        // get().loadMessages(chatId);
      }
    );
  },

  uploadFile: async (chatId, file) => {
     set({ isStreaming: true });
     try {
       const response = await chatService.uploadFile(chatId, file);
       // response is array of created messages (User msg with attachment)
       if (Array.isArray(response)) {
          set((state) => ({ messages: [...response.reverse(), ...state.messages] }));
       } else {
          // single object?
          // The backend returns a list of created messages.
          // Let's assume list.
       }
     } catch (e) {
       console.error(e);
     } finally {
       set({ isStreaming: false });
     }
  }
}));
