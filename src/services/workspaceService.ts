import client from '../api/client';
import { Workspace } from '../types';

export const workspaceService = {
  getSubscribedWorkspaces: async (): Promise<Workspace[]> => {
    const response = await client.get<Workspace[]>('/api/v1/bots/subscribed/');
    return response.data;
  },
};
