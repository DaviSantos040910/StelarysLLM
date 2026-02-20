import { create } from 'zustand';
import { Message, ChatListItem } from '../types/chat';
import { chatService } from '../services/chatService';
import { streamMessage, StreamMetadata } from '../services/streamApi';
import { router } from 'expo-router';

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
  regenerateMessage: (chatId: string | number) => Promise<void>;
  updateMessage: (messageId: string | number, updates: Partial<Message>) => void;
  addMessage: (message: Message) => void;
  uploadFile: (chatId: string | number, file: any) => Promise<void>;
  setCurrentChat: (chat: ChatListItem) => void;
  updateCurrentChatBot: (botUpdates: any) => void;
}

const generateLocalId = () => `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentChat: null,
  isLoading: false,
  isStreaming: false,
  error: null,
  hasMore: true,
  page: 1,

  setCurrentChat: (chat) => set({ currentChat: chat }),

  updateCurrentChatBot: (botUpdates) => set((state) => ({
      currentChat: state.currentChat ? {
          ...state.currentChat,
          bot: { ...state.currentChat.bot, ...botUpdates }
      } : null
  })),

  loadMessages: async (chatId) => {
    set({ isLoading: true, error: null, page: 1, hasMore: true });
    try {
      const messages = await chatService.getMessages(chatId);
      const processedMessages = (Array.isArray(messages) ? messages : []).map(m => ({
          ...m,
          localId: m.id.toString() // Stable localId for backend messages
      }));
      set({ messages: processedMessages, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load messages', isLoading: false });
    }
  },

  loadMoreMessages: async (chatId) => {
      const { hasMore, page, isLoading } = get();
      if (!hasMore || isLoading) return;

      set({ isLoading: true });
      try {
          // Pagination implementation deferred
          set({ isLoading: false });
      } catch (e) {
          set({ isLoading: false });
      }
  },

  addMessage: (message) => {
    const currentMessages = get().messages || [];
    const msgWithLocal = { ...message, localId: message.localId || generateLocalId() };
    set({ messages: [msgWithLocal, ...currentMessages] });
  },

  updateMessage: (messageId, updates) => {
      set((state) => ({
          messages: state.messages.map((m) =>
              String(m.id) === String(messageId) ? { ...m, ...updates } : m
          )
      }));
  },

  regenerateMessage: async (chatId) => {
      const { messages } = get();
      const lastMsg = messages[0];
      // Allow regenerating if last is assistant (rewrite) OR if last is user (retry/generate)?
      // Usually "regenerate" implies re-rolling the assistant's last reply.
      if (lastMsg?.role !== 'assistant') return;

      // Remove the last assistant message locally
      set((state) => ({
          messages: state.messages.slice(1),
          isStreaming: true
      }));

      // Create a placeholder streaming message
      const aiLocalId = generateLocalId();
      const aiMsgId = `temp-regen-${Date.now()}`;
      const aiMsg: Message = {
          id: aiMsgId,
          localId: aiLocalId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          status: 'sending'
      };

      set((state) => ({ messages: [aiMsg, ...state.messages] }));

      // Call streaming rewrite service
      await chatService.regenerateMessageStream(chatId, {
          onChunk: (chunk) => {
              set((state) => ({
                  messages: state.messages.map((m) =>
                      m.localId === aiLocalId ? { ...m, content: m.content + chunk } : m
                  )
              }));
          },
          onFinish: (meta) => {
              set((state) => ({
                  isStreaming: false,
                  messages: state.messages.map((m) => {
                      if (m.localId === aiLocalId) {
                          const safeId = (meta.message_id && meta.message_id !== '0' && meta.message_id !== 0)
                              ? meta.message_id
                              : m.id;

                          const finalContent = (!m.content || m.content.length === 0) && meta.clean_content
                              ? meta.clean_content
                              : m.content;

                          return {
                              ...m,
                              status: 'sent',
                              id: safeId,
                              content: finalContent,
                              suggestions: meta.suggestions && meta.suggestions.length > 0 ? meta.suggestions : m.suggestions,
                              sources: meta.sources || m.sources,
                              warning: meta.warning
                          };
                      }
                      return m;
                  })
              }));
          },
          onError: (err) => {
              console.error("Regenerate stream error:", err);
              set({ error: 'Failed to regenerate message', isStreaming: false });
              get().loadMessages(chatId);
          }
      });
  },

  sendMessage: async (chatId, text) => {
    const userLocalId = generateLocalId();
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      localId: userLocalId,
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

    const aiLocalId = generateLocalId();
    const aiMsgId = `temp-stream-${Date.now()}`;
    const aiMsg: Message = {
      id: aiMsgId,
      localId: aiLocalId,
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
                  m.localId === aiLocalId ? { ...m, content: m.content + chunk } : m
                )
            }));
          },
          onFinish: (meta) => {
             set((state) => ({
                isStreaming: false,
                messages: state.messages.map((m) => {
                    if (m.localId === aiLocalId) {
                        // Defensive: Ensure we don't overwrite temp ID with '0'
                        const safeId = (meta.message_id && meta.message_id !== '0' && meta.message_id !== 0)
                            ? meta.message_id
                            : m.id;

                        // Fallback: If content is empty but clean_content exists (e.g. strict mode single chunk)
                        const finalContent = (!m.content || m.content.length === 0) && meta.clean_content
                            ? meta.clean_content
                            : m.content;

                        return {
                            ...m,
                            status: 'sent',
                            id: safeId,
                            content: finalContent,
                            suggestions: meta.suggestions && meta.suggestions.length > 0 ? meta.suggestions : m.suggestions,
                            sources: meta.sources || m.sources,
                            warning: meta.warning
                        };
                    }
                    if (m.localId === userLocalId) {
                        const safeUserId = (meta.user_message_id && meta.user_message_id !== '0' && meta.user_message_id !== 0)
                            ? meta.user_message_id
                            : m.id;

                        return {
                            ...m,
                            status: 'sent',
                            id: safeUserId
                        };
                    }
                    return m;
                })
             }));
          },
          onError: (err: any) => {
              set({ error: err.message || 'Failed to send message', isStreaming: false });

              // Update message UI to show error bubble
              set((state) => ({
                  messages: state.messages.map(m =>
                      m.localId === userLocalId || m.localId === aiLocalId
                        ? { ...m, status: 'error', content: m.role === 'assistant' ? (err.message || 'Erro ao processar') : m.content }
                        : m
                  )
              }));

              // Handle Quota/Limits specifically
              if (err.code?.includes('limit') || err.message?.includes('atingiu') || err.message?.includes('quota')) {
                  try {
                      router.push({
                          pathname: '/paywall',
                          params: {
                              title: 'Limite Atingido',
                              message: err.message
                          }
                      });
                  } catch(e) { console.error("Nav error", e); }
              }
          }
      }
    );
  },

  uploadFile: async (chatId, file) => {
     const userLocalId = generateLocalId();
     const aiLocalId = generateLocalId();

     const tempUserMsgId = `temp-audio-${Date.now()}`;
     const tempBotMsgId = `temp-bot-${Date.now()}`;
     const isAudio = file.type?.startsWith('audio/') || file.mimeType?.startsWith('audio/');

     const userMsg: Message = {
         id: tempUserMsgId,
         localId: userLocalId,
         role: 'user',
         content: '',
         attachment_url: file.uri,
         attachment_type: file.mimeType || (isAudio ? 'audio/m4a' : 'file'),
         created_at: new Date().toISOString(),
         duration: file.duration,
         status: 'sending'
     };

     const botMsg: Message = {
         id: tempBotMsgId,
         localId: aiLocalId,
         role: 'assistant',
         content: '',
         created_at: new Date().toISOString(),
         status: 'sending'
     };

     set((state) => ({
         messages: [botMsg, userMsg, ...state.messages],
         isStreaming: true
     }));

     try {
       let response;

       if (isAudio) {
           response = await chatService.sendVoiceMessage(chatId, file);
       } else {
           response = await chatService.uploadFile(chatId, file);
       }

       if (Array.isArray(response)) {
          const realUserMsg = response.find(m => m.role === 'user');
          const realBotMsg = response.find(m => m.role === 'assistant');

          set((state) => ({
              messages: state.messages.map(m => {
                  if (m.localId === userLocalId && realUserMsg) return { ...realUserMsg, localId: userLocalId };
                  if (m.localId === aiLocalId && realBotMsg) return { ...realBotMsg, localId: aiLocalId };
                  if (m.localId === aiLocalId && !realBotMsg) return { ...m, status: 'error', content: 'No response received.' };
                  return m;
              }),
              isStreaming: false
          }));
       } else {
           set((state) => ({
               messages: state.messages.filter(m => m.localId !== aiLocalId),
               isStreaming: false
           }));
       }
     } catch (e) {
       console.error(e);
       set((state) => ({
           error: 'Failed to upload file',
           isStreaming: false,
           messages: state.messages.filter(m => m.localId !== aiLocalId).map(m =>
               m.localId === userLocalId ? { ...m, status: 'error' } : m
           )
       }));
     }
  }
}));
