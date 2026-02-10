// src/types/chat.ts

// Represents a single message in a conversation.
export type Message = {
  id: string | number; // Updated to allow number (backend ID) or string (frontend temp ID)
  localId?: string; // Stable ID for UI rendering to prevent flashes during ID swaps
  role: 'user' | 'assistant';
  content: string;
  created_at: string; // Add timestamp
  // Optional fields that might be used on the frontend
  feedback?: 'like' | 'dislike' | null; // Updated from liked?: boolean
  rewriting?: boolean;
  audioUri?: string | null;
  audio_url?: string | null; // TTS URL cached from backend
  suggestions?: string[];
  attachment_url?: string | null;
  attachment_type?: string | null;
  original_filename?: string | null;
  duration?: number;
  // Status do envio da mensagem (controle local)
  status?: 'sending' | 'sent' | 'error';
};

// Represents the bot's details.
export type Bot = {
  id: string;
  name: string;
  description: string;
  avatar_url?: string | null;
  theme_color?: string; // Added
  background_image?: string | null; // Added
  is_official?: boolean;
  suggestion1?: string;
  suggestion2?: string;
  suggestion3?: string;
  createdByMe?: boolean; // Added based on backend response
  allow_web_search?: boolean;
  strict_context?: boolean;
  prompt?: string;
  study_spaces?: any[];
};

// Represents an item in the main chat list screen.
export type ChatListItem = {
  id: string; // This is the Chat ID
  bot: Bot;
  last_message: Message | null;
  last_message_at: string;
  status: 'active' | 'archived';
};

// Represents the initial data needed when opening a chat screen.
export type ChatBootstrap = {
  conversationId: string;
  bot: { name: string; handle: string; avatarUrl?: string; createdByMe?: boolean; theme_color?: string; background_image?: string | null };
  welcome: string;
  suggestions: string[];
};

// Represents the paginated response for messages from the backend.
export type PaginatedMessages = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Message[];
};

export interface ChatCacheData {
  messages: Message[];
  nextPage: number | null;
  timestamp: number; // Unix timestamp (ms) de quando o cache foi salvo
}

export interface ChatContextValue {
  playTTS: (conversationId: string, messageId: string) => Promise<void>;
  stopTTS: () => Promise<void>;
  isTTSPlaying: boolean;
  isTTSLoading: boolean;
  currentTTSMessageId: string | null;
}

export interface ChatSource {
    id: number;
    title: string;
    name?: string;
    type?: string;
    source_type?: 'FILE' | 'URL' | 'YOUTUBE' | 'kb';
    extracted_text?: string;
    created_at?: string;
    url?: string;
    selected?: boolean;
    status?: 'pending' | 'processed' | 'error'; // Added status
}

export interface SourceRef {
    id: string;
    title: string;
    type: string;
    url?: string;
    index: number;
}
