import client from '../api/client';
import { Workspace } from '../types';

export const workspaceService = {
  getSubscribedWorkspaces: async (): Promise<Workspace[]> => {
    const response = await client.get<Workspace[]>('/api/v1/bots/subscribed/');
    return response.data;
  },

  createWorkspace: async (data: { name: string; category_id: string; prompt: string }): Promise<Workspace> => {
    const response = await client.post<Workspace>('/api/v1/bots/', data);
    return response.data;
  },

  bootstrapChat: async (botId: string): Promise<{ id: number }> => {
    const response = await client.get<{ id: number }>(`/api/v1/chats/bootstrap/bot/${botId}/`);
    return response.data;
  },

  uploadFile: async (chatId: number, file: any) => {
    const formData = new FormData();

    // React Native needs uri, name, type for FormData
    formData.append('attachment', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as any);

    // Based on backend: 'content' field is required by serializer if not optional,
    // but ChatMessageAttachmentSerializer usually handles it.
    // The view sets content to empty string if missing.
    // Let's add it just in case.
    formData.append('content', '');

    const response = await client.post(`/api/v1/chats/${chatId}/messages/attach/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
