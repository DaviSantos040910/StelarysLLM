import client from '../api/client';
import { ChatBootstrap } from '../types/chat';

export interface CreateBotData {
    name: string;
    description?: string;
    prompt: string;
    allow_web_search: boolean;
    strict_context: boolean; // Added strict_context
    avatar?: any;
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
      formData.append('allow_web_search', String(data.allow_web_search));
      formData.append('strict_context', String(data.strict_context));
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

      // Fixed: URL should be /api/v1/bots/ (POST), not /my-bots/ which was removed or legacy
      const response = await client.post('/api/v1/bots/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
  },

  async getBot(botId: string): Promise<any> {
      const response = await client.get(`/api/v1/bots/${botId}/`);
      return response.data;
  },

  async getBots(params?: any): Promise<any[]> {
    const response = await client.get('/api/v1/bots/', { params });
    // Handle pagination if necessary
    if (response.data && response.data.results) {
        return response.data.results;
    }
    return response.data;
  },

  async updateBot(botId: string, data: Partial<CreateBotData>): Promise<any> {
      const formData = new FormData();
      if (data.name) formData.append('name', data.name);
      if (data.prompt) formData.append('prompt', data.prompt);
      if (data.allow_web_search !== undefined) formData.append('allow_web_search', String(data.allow_web_search));
      if (data.strict_context !== undefined) formData.append('strict_context', String(data.strict_context));
      if (data.publicity) formData.append('publicity', data.publicity);
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

      const response = await client.patch(`/api/v1/bots/${botId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
  }
};
