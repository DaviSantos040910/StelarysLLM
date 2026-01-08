import { create } from 'zustand';
import { KnowledgeArtifact } from '../types/studio';

interface MinimizedState {
  minimizedArtifact: KnowledgeArtifact | null;
  minimize: (artifact: KnowledgeArtifact) => void;
  maximize: () => void;
  close: () => void;
}

export const useMinimizedStore = create<MinimizedState>((set) => ({
  minimizedArtifact: null,
  minimize: (artifact) => set({ minimizedArtifact: artifact }),
  maximize: () => set({ minimizedArtifact: null }), // Consuming component handles the UI restoration
  close: () => set({ minimizedArtifact: null }),
}));
