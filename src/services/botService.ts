import client from '../api/client';
import { ChatBootstrap } from '../types/chat';

export const botService = {
  /**
   * Fetches the bootstrap data for a specific bot from the backend.
   * This endpoint finds or creates an active chat session.
   * @param botId - The unique identifier for the bot.
   * @returns A promise that resolves with the ChatBootstrap data from the API.
   */
  async getChatBootstrap(botId: string): Promise<ChatBootstrap> {
    const response = await client.get<ChatBootstrap>(`/api/v1/chats/bootstrap/bot/${botId}/`);
    return response.data;
  },
};
