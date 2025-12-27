// src/services/searchHistoryService.ts
import client from '../api/client';

export type SearchHistoryItem = {
  id: string;
  term: string;
};

// This is the real service that interacts with your Django backend API.
const realSearchHistoryService = {
  /**
   * Fetches the user's search history from the server.
   * @returns A promise that resolves with an array of search history items.
   */
  async getHistory(): Promise<SearchHistoryItem[]> {
    try {
      const response = await client.get<SearchHistoryItem[]>('/api/v1/explore/history/');
      return response.data;
    } catch (e) {
      console.error('Failed to fetch search history.', e);
      return [];
    }
  },

  /**
   * Adds a new search term to the user's history on the server.
   * @param term - The search term to add.
   * @returns A promise that resolves with the updated list of search history items.
   */
  async addSearchTerm(term: string): Promise<SearchHistoryItem[]> {
    if (!term.trim()) return await this.getHistory();
    try {
      // The backend will handle creating a new entry or updating the timestamp of an existing one.
      await client.post('/api/v1/explore/history/', { term });
      return await this.getHistory();
    } catch (e) {
      console.error('Failed to save search term.', e);
      // Return the existing history on failure
      return await this.getHistory();
    }
  },

  /**
   * Removes a specific search term from the user's history on the server.
   * @param id - The ID of the history item to remove.
   * @returns A promise that resolves with the updated list of search history items.
   */
  async removeSearchTerm(id: string): Promise<SearchHistoryItem[]> {
    try {
        await client.delete(`/api/v1/explore/history/${id}/`);
        return await this.getHistory();
    } catch(e) {
        console.error('Failed to remove search term', e);
        return await this.getHistory();
    }
  },

  /**
   * Clears the entire search history for the user on the server.
   */
  async clearHistory(): Promise<void> {
    try {
        await client.delete('/api/v1/explore/history/');
    } catch(e) {
        console.error('Failed to clear history', e);
    }
  },
};

export default realSearchHistoryService;
