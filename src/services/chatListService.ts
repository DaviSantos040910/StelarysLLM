// src/services/chatListService.ts
import client from '../api/client';
import { ChatListItem } from '../types/chat';

/**
 * Real API implementation for the Chat List service.
 */
const realChatListService = {
  /**
   * Fetches the list of active chat sessions for the current user.
   * The list is ordered by the most recent message.
   * @returns A promise that resolves with an array of ChatListItem objects.
   */
  async getActiveChats(): Promise<ChatListItem[]> {
    try {
      const response = await client.get<ChatListItem[]>('/api/v1/chats/');
      return response.data;
    } catch (error) {
      console.error("Failed to fetch active chats:", error);
      // Return an empty array in case of an error to prevent the app from crashing.
      return [];
    }
  },
};

export const chatListService = realChatListService;
