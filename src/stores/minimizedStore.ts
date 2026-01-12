import { create } from 'zustand';
import { KnowledgeArtifact } from '../types/studio';

interface MinimizedState {
  minimizedArtifact: KnowledgeArtifact | null;
  minimizeNote: (artifact: KnowledgeArtifact) => void;
  maximizeNote: () => void;
  closeNote: () => void;
}

export const useMinimizedStore = create<MinimizedState>((set) => ({
  minimizedArtifact: null,
  minimizeNote: (artifact) => set({ minimizedArtifact: artifact }),
  maximizeNote: () => set({ minimizedArtifact: null }), // Consuming component handles the UI restoration
  closeNote: () => set({ minimizedArtifact: null }),
}));
