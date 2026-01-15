import { KnowledgeArtifact, ArtifactType } from '../types/studio';
import * as FileSystem from 'expo-file-system/legacy';
import apiClient, { BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Alert } from 'react-native';

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

        const payload: any = {
            chat: isNaN(chatInt) ? chatId : chatInt,
            type,
            title
        };

        // Do not send 'content' key at all if it is empty, to rely on backend default/null handling
        // payload.content = null;

        try {
            const response = await apiClient.post<KnowledgeArtifact>('/api/v1/studio/artifacts/', payload);
            return response.data;
        } catch (error: any) {
            console.error("Studio Generation Error Details:", error.response?.data);
            if (error.response?.data) {
                 // Format the validation errors for display
                 const errorMsg = Object.entries(error.response.data)
                    .map(([key, val]) => `${key}: ${val}`)
                    .join('\n');
                 Alert.alert("Erro de Validação", errorMsg);
            }
            throw error;
        }
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
