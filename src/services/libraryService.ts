import apiClient from '../api/client';
import { CreateSpaceParams, StudySpace } from '../types/studio';

export const libraryService = {
    async getSpaces(): Promise<StudySpace[]> {
        const response = await apiClient.get<StudySpace[]>('/api/v1/studio/spaces/');
        return response.data;
    },

    async createSpace(data: CreateSpaceParams): Promise<StudySpace> {
        const response = await apiClient.post<StudySpace>('/api/v1/studio/spaces/', data);
        return response.data;
    },

    async getSpace(id: number): Promise<StudySpace> {
        const response = await apiClient.get<StudySpace>(`/api/v1/studio/spaces/${id}/`);
        return response.data;
    },

    async addSpaceSource(spaceId: number, fileOrUrl: any, type: 'FILE' | 'URL' | 'YOUTUBE'): Promise<any> {
        const formData = new FormData();

        formData.append('title', fileOrUrl.name || 'Nova Fonte');
        formData.append('source_type', type);

        if (type === 'FILE') {
            formData.append('file', {
                uri: fileOrUrl.uri,
                name: fileOrUrl.name,
                type: fileOrUrl.mimeType || 'application/octet-stream',
            } as any);
        } else {
            formData.append('url', fileOrUrl.uri || fileOrUrl);
            if (!fileOrUrl.name) formData.append('title', fileOrUrl.uri || fileOrUrl);
        }

        // IMPORTANT: Do NOT set Content-Type manually for FormData.
        // The networking library (Axios/fetch) will set it with the correct boundary.
        const response = await apiClient.post(`/api/v1/studio/spaces/${spaceId}/add_source/`, formData);
        return response.data;
    },

    async addSource(spaceId: number, sourceId: number): Promise<void> {
        await apiClient.post(`/api/v1/studio/spaces/${spaceId}/add_source/`, { source_id: sourceId });
    },

    async removeSource(spaceId: number, sourceId: number): Promise<void> {
        await apiClient.post(`/api/v1/studio/spaces/${spaceId}/remove_source/`, { source_id: sourceId });
    },

    async linkBot(spaceId: number, botId: number): Promise<void> {
        await apiClient.post(`/api/v1/studio/spaces/${spaceId}/link_bot/`, { bot_id: botId });
    },

    async unlinkBot(spaceId: number, botId: number): Promise<void> {
        await apiClient.post(`/api/v1/studio/spaces/${spaceId}/unlink_bot/`, { bot_id: botId });
    },

    // Manage Sources independently
    async getSources(): Promise<any[]> {
        const response = await apiClient.get('/api/v1/studio/sources/');
        return response.data;
    }
};
