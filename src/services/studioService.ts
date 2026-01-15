import { KnowledgeArtifact, ArtifactType } from '../types/studio';
import * as FileSystem from 'expo-file-system/legacy';
import apiClient, { BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';

export const studioService = {
    async getArtifacts(chatId: string): Promise<KnowledgeArtifact[]> {
        const response = await apiClient.get<KnowledgeArtifact[]>('/api/v1/studio/artifacts/', {
            params: { chat_id: chatId }
        });
        return response.data;
    },

    async generateArtifact(chatId: string, type: ArtifactType, title: string): Promise<KnowledgeArtifact> {
        // Parse chatId to integer to ensure backend serializer accepts it
        const chatInt = parseInt(chatId, 10);

        const response = await apiClient.post<KnowledgeArtifact>('/api/v1/studio/artifacts/', {
            chat: isNaN(chatInt) ? chatId : chatInt,
            type,
            title,
            // Explicitly send null content to satisfy potential strict checks, though backend should handle missing
            content: null
        });
        return response.data;
    },

    /**
     * Exports an artifact by downloading it from the backend API.
     */
    async exportArtifact(artifactId: number, format: string): Promise<string> {
        const fileName = `artifact_${artifactId}.${format}`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        const token = useAuthStore.getState().token;

        try {
            const downloadRes = await FileSystem.downloadAsync(
                `${BASE_URL}/api/v1/studio/artifacts/${artifactId}/export/`,
                fileUri,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (downloadRes.status !== 200) {
                 throw new Error(`Download failed with status ${downloadRes.status}`);
            }

            return downloadRes.uri;
        } catch (e) {
            console.error("Export error:", e);
            throw e;
        }
    }
};
