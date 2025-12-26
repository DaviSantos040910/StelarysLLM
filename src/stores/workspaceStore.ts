import { create } from 'zustand';
import { Workspace } from '../types';
import { workspaceService } from '../services/workspaceService';

interface WorkspaceState {
  workspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
  loadWorkspaces: () => Promise<void>;
  setWorkspaces: (workspaces: Workspace[]) => void;
  createStudy: (data: { name: string; category: string; files: any[] }) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  isLoading: false,
  error: null,
  loadWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await workspaceService.getSubscribedWorkspaces();
      set({ workspaces, isLoading: false });
    } catch (error) {
      console.error('Failed to load workspaces', error);
      set({ error: 'Failed to load workspaces', isLoading: false });
    }
  },
  setWorkspaces: (workspaces) => set({ workspaces }),

  createStudy: async ({ name, category, files }) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Create Workspace (Bot)
      const bot = await workspaceService.createWorkspace({
        name,
        category: category, // Fix: usage of 'category' property name to match service definition
        prompt: "Você é um assistente especialista neste tema. Responda com base nos arquivos.",
      });

      // 2. If files, Bootstrap Chat and Upload
      if (files.length > 0) {
        const chat = await workspaceService.bootstrapChat(bot.id);

        for (const file of files) {
           await workspaceService.uploadFile(chat.id, file);
        }
      }

      // 3. Reload list
      await get().loadWorkspaces();

      set({ isLoading: false });
    } catch (error: any) {
      console.error('Failed to create study', error);
      set({
        error: error.response?.data?.detail || 'Failed to create study',
        isLoading: false
      });
      throw error;
    }
  },
}));
