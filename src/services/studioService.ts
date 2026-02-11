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

        // Normalize artifacts, especially Podcast structured content
        return response.data.map(artifact => {
            if (artifact.type === 'PODCAST' && typeof artifact.content === 'object' && !Array.isArray(artifact.content)) {
                const content = artifact.content as any; // Cast to access new fields safely
                const transcript = content.transcript || [];

                // 1. Process Transcript (ms -> seconds)
                const mappedTranscript = transcript.length > 0
                    ? transcript.map((t: any) => ({
                        speaker: t.display_name || t.speaker || 'Host',
                        text: t.text,
                        start: (t.start_ms || 0) / 1000,
                        end: (t.end_ms || 0) / 1000
                    }))
                    : (content.dialogue || []).map((d: any, i: number) => ({
                        // Fallback: simple text list without timestamps if not available
                        speaker: d.display_name || d.speaker || 'Host',
                        text: d.text,
                        start: i * 5, // Fake timestamps for visual flow
                        end: (i + 1) * 5
                    }));

                // 2. Process Chapters (turn index -> seconds via transcript)
                const mappedChapters = (content.chapters || []).map((c: any) => {
                    const turnIndex = c.start_turn_index || 0;
                    // Find corresponding transcript segment to get time
                    // If transcript exists and index is valid
                    let startTime = 0;
                    // Note: turnIndex matches mappedTranscript index because both are derived from the same sequential dialogue
                    if (mappedTranscript.length > turnIndex) {
                        startTime = mappedTranscript[turnIndex].start;
                    }
                    return {
                        title: c.title,
                        start: startTime,
                        end: startTime + 60 // Temporary end
                    };
                });

                // Calculate end times for chapters
                for (let i = 0; i < mappedChapters.length; i++) {
                    if (i < mappedChapters.length - 1) {
                        mappedChapters[i].end = mappedChapters[i+1].start;
                    } else if (mappedTranscript.length > 0) {
                        mappedChapters[i].end = mappedTranscript[mappedTranscript.length - 1].end;
                    }
                }

                return {
                    ...artifact,
                    transcript: mappedTranscript,
                    chapters: mappedChapters
                };
            }
            return artifact;
        });
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

        // Wrap config options in a 'config' object as expected by backend's KnowledgeArtifactViewSet
        const payload = {
            chat: chatInt, // Send as integer for Django ForeignKey
            type,
            title,
            config: {
                quantity: options?.quantity,
                difficulty: options?.difficulty,
                selectedSourceIds: options?.sourceIds, // Backend expects 'selectedSourceIds' inside config
                customInstructions: options?.customInstructions,
                duration: options?.targetDuration
            }
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
