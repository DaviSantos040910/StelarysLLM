import { create } from 'zustand';
import { Workspace } from '../types';
import { workspaceService } from '../services/workspaceService';

interface WorkspaceState {
  workspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
  loadWorkspaces: () => Promise<void>;
  setWorkspaces: (workspaces: Workspace[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
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
}));
