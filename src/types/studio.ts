export type ArtifactType = 'PODCAST' | 'QUIZ' | 'FLASHCARD' | 'SUMMARY' | 'SLIDE';

export interface SlidePage {
  title: string;
  bullets: string[];
  image_prompt?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface FlashcardItem {
  front: string;
  back: string;
}

export interface KnowledgeArtifact {
  id: string;
  chatId: string;
  type: ArtifactType;
  title: string;
  status: 'processing' | 'ready' | 'error';
  mediaUrl?: string; // For PODCAST audio
  duration?: string; // For PODCAST duration display
  score?: string; // For QUIZ results (if taken)
  // Polymorphic content
  content?: SlidePage[] | QuizQuestion[] | FlashcardItem[] | string;
  createdAt: string;
}
