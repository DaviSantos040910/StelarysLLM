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
        // According to instructions, we use the standard CREATE endpoint.
        // The backend handles generation synchronously or asynchronously.
        const response = await apiClient.post<KnowledgeArtifact>('/api/v1/studio/artifacts/', {
            chat: chatId, // Changed to 'chat' (ID) as requested
            type,
            title
        });
        return response.data;
    },

    /**
     * Exports an artifact by downloading it from the backend API.
     */
    async exportArtifact(artifactId: number, format: string): Promise<string> {
        // Need title to name the file? We might need to fetch the artifact first or pass title.
        // For now, we'll use a generic name or try to guess.
        // Ideally the caller passes the title or we do a quick fetch.
        // Let's assume the caller just wants the file.
        // We will name it `artifact_{id}.{format}`.

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
