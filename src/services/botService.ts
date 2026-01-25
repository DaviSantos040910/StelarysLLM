import client from '../api/client';
import { ChatBootstrap } from '../types/chat';

export interface CreateBotData {
    name: string;
    description?: string;
    prompt: string;
    theme_color: string;
    allow_web_search: boolean;
    avatar?: any;
    background_image?: any;
    category_ids?: string[];
    study_space_ids?: number[];
    publicity: 'Public' | 'Private' | 'Guests';
}

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

  async createBot(data: CreateBotData): Promise<any> {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('prompt', data.prompt);
      formData.append('theme_color', data.theme_color);
      formData.append('allow_web_search', String(data.allow_web_search));
      formData.append('publicity', data.publicity);

      if (data.description) formData.append('description', data.description);

      if (data.category_ids) {
          data.category_ids.forEach(id => formData.append('category_ids', id));
      }

      if (data.study_space_ids) {
          data.study_space_ids.forEach(id => formData.append('study_space_ids', String(id)));
      }

      if (data.avatar && data.avatar.uri) {
          formData.append('avatar_url', {
              uri: data.avatar.uri,
              name: data.avatar.name || 'avatar.jpg',
              type: data.avatar.mimeType || 'image/jpeg',
          } as any);
      }

      if (data.background_image && data.background_image.uri) {
          formData.append('background_image', {
              uri: data.background_image.uri,
              name: data.background_image.name || 'background.jpg',
              type: data.background_image.mimeType || 'image/jpeg',
          } as any);
      }

      const response = await client.post('/api/v1/bots/my-bots/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
  }
};
