import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import apiClient, { BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { ArtifactType, KnowledgeArtifact, ContextSource, ArtifactGenerationOptions } from '../types/studio';

export const studioService = {
    async getArtifacts(chatId: string): Promise<KnowledgeArtifact[]> {
        const response = await apiClient.get<KnowledgeArtifact[]>('/api/v1/studio/artifacts/', {
            params: { chat_id: chatId }
        });
        return response.data;
    },

    async getSources(chatId: string): Promise<ContextSource[]> {
        try {
            // Updated URL to match nested backend route: /api/v1/chats/<id>/context-sources/
            const response = await apiClient.get<ContextSource[]>(`/api/v1/chats/${chatId}/context-sources/`);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch context sources:", error);
            return [];
        }
    },

    async generateArtifact(
        chatId: string,
        type: ArtifactType,
        title: string,
        options?: ArtifactGenerationOptions
    ): Promise<KnowledgeArtifact> {
        // Parse chatId to integer - Django ForeignKey expects an integer, not a string
        const chatInt = parseInt(chatId, 10);

        // Validate that we have a valid chat ID before making the request
        if (isNaN(chatInt) || chatInt <= 0) {
            throw new Error('Invalid chat ID: cannot generate artifact without a valid chat.');
        }

        const payload = {
            chat: chatInt, // Send as integer for Django ForeignKey
            type,
            title,
            // Map optional config fields
            quantity: options?.quantity,
            difficulty: options?.difficulty,
            source_ids: options?.sourceIds,
            custom_instructions: options?.customInstructions,
            include_chat_history: options?.includeChatHistory,
            // Map targetDuration to 'duration' as requested by API contract
            duration: options?.targetDuration
        };

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
