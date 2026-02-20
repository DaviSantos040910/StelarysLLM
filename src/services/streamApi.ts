// src/services/streamApi.ts
import EventSource, { EventSourceListener } from "react-native-sse";
import { getAuthHeaders } from '../api/authHeaders';
import { BASE_URL } from '../api/client';
import { SourceRef } from "../types/chat";

export interface StreamMetadata {
    message_id?: string;
    user_message_id?: string;
    type?: 'start' | 'chunk' | 'end' | 'error';
    text?: string;
    detail?: string;
    clean_content?: string;
    suggestions?: string[];
    sources?: SourceRef[];
    error?: boolean;
    code?: string;
    message?: string;
    meta?: any;
    warning?: string;
}

export interface StreamCallbacks {
    onStart?: (metadata: StreamMetadata) => void;
    onChunk: (text: string) => void;
    onFinish: (metadata: StreamMetadata) => void;
    onError: (error: Error & { code?: string; meta?: any }) => void;
}

export const streamMessage = async (
    chatId: string | number,
    content: string,
    callbacks: StreamCallbacks
): Promise<(() => void) | undefined> => {
    const authHeaders = getAuthHeaders();

    if (!authHeaders.Authorization && !authHeaders['X-Guest-Id']) {
        callbacks.onError(new Error('Authentication failed: No token or guest session'));
        return undefined;
    }

    const url = `${BASE_URL}/api/v1/chats/${chatId}/stream/`;

    // Create EventSource connection
    const es = new EventSource<"message" | "error" | "open">(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            ...authHeaders,
        },
        body: JSON.stringify({ content }),
        pollingInterval: 0,
    });

    const listener: EventSourceListener<"message" | "error" | "open"> = (event) => {
        switch (event.type) {
            case 'open':
                break;

            case 'message':
                try {
                    const data = JSON.parse(event.data || '{}') as StreamMetadata;

                    switch (data.type) {
                        case 'start':
                            if (callbacks.onStart) {
                                callbacks.onStart(data);
                            }
                            break;
                        case 'chunk':
                            if (data.text) {
                                callbacks.onChunk(data.text);
                            }
                            break;
                        case 'end':
                            es.close();
                            callbacks.onFinish(data);
                            break;
                        case 'error':
                            es.close();
                            const err = new Error(data.message || data.detail || 'Stream error');
                            (err as any).code = data.code;
                            (err as any).meta = data.meta;
                            callbacks.onError(err);
                            break;
                    }
                } catch (err) {
                    console.warn('[StreamApi] Parse error:', err);
                }
                break;

            case 'error':
                es.close();
                callbacks.onError(new Error('Connection lost'));
                break;
        }
    };

    es.addEventListener('open', listener);
    es.addEventListener('message', listener);
    es.addEventListener('error', listener);

    return () => {
        es.removeAllEventListeners();
        es.close();
    };
};
