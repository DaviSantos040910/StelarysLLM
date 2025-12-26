import { create } from 'zustand';

interface WorkspaceState {
  workspaces: any[];
  setWorkspaces: (workspaces: any[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
}));
