// src/services/exploreService.ts
import client from '../api/client';
import { Bot } from '../types/chat';

export type ExploreBotItem = Bot & { is_subscribed?: boolean };
export type Category = { id: string; name: string; };

const realExploreService = {
  async getCategories(): Promise<Category[]> {
    const response = await client.get<Category[]>('/api/v1/explore/categories/');
    return response.data;
  },

  async getBots(categoryId: string): Promise<ExploreBotItem[]> {
    const response = await client.get<ExploreBotItem[]>(`/api/v1/explore/bots/?category_id=${categoryId}`);
    return response.data;
  },

  async searchBots(query: string): Promise<ExploreBotItem[]> {
    const response = await client.get<ExploreBotItem[]>(`/api/v1/explore/bots/?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  async toggleBotSubscription(botId: string): Promise<{ status: 'subscribed' | 'unsubscribed' }> {
    const response = await client.post<{ status: 'subscribed' | 'unsubscribed' }>(`/api/v1/bots/${botId}/subscribe/`);
    return response.data;
  },
};

export const exploreService = realExploreService;
