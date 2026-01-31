import apiClient, { BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { CreateSpaceParams, StudySpace } from '../types/studio';

const getHeaders = async () => {
    const token = useAuthStore.getState().token;
    return {
        'Authorization': `Bearer ${token}`,
    };
};

export const libraryService = {
    async getSpaces(): Promise<StudySpace[]> {
        const response = await apiClient.get<StudySpace[]>('/api/v1/studio/spaces/');
        return response.data;
    },

    async createSpace(data: CreateSpaceParams): Promise<StudySpace> {
        if (data.coverImage) {
            const formData = new FormData();
            formData.append('title', data.title);
            if (data.description) formData.append('description', data.description);

            // Handle image
            formData.append('cover_image', {
                uri: data.coverImage.uri,
                name: data.coverImage.fileName || data.coverImage.name || 'cover.jpg',
                type: data.coverImage.mimeType || data.coverImage.type || 'image/jpeg',
            } as any);

            if (data.source_ids) {
                data.source_ids.forEach(id => formData.append('source_ids', id.toString()));
            }
            if (data.bot_ids) {
                data.bot_ids.forEach(id => formData.append('bot_ids', id.toString()));
            }

            const headers = await getHeaders();
            const response = await fetch(`${BASE_URL}/api/v1/studio/spaces/`, {
                method: 'POST',
                headers: {
                    ...headers,
                    // Content-Type must be undefined for FormData
                },
                body: formData as any,
            });

            if (!response.ok) throw new Error('Failed to create space');
            return await response.json();
        } else {
            const response = await apiClient.post<StudySpace>('/api/v1/studio/spaces/', data);
            return response.data;
        }
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
                type: fileOrUrl.mimeType || fileOrUrl.type || 'application/octet-stream',
            } as any);
        } else {
            formData.append('url', fileOrUrl.uri || fileOrUrl);
            if (!fileOrUrl.name) formData.append('title', fileOrUrl.uri || fileOrUrl);
        }

        const headers = await getHeaders();
        const response = await fetch(`${BASE_URL}/api/v1/studio/spaces/${spaceId}/add_source/`, {
            method: 'POST',
            headers: {
                ...headers,
            },
            body: formData as any,
        });

        if (!response.ok) {
            const err = await response.text();
            console.log('Add source error:', err);
            throw new Error('Failed to add source');
        }
        return await response.json();
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

    async getSources(): Promise<any[]> {
        const response = await apiClient.get('/api/v1/studio/sources/');
        return response.data;
    }
};
