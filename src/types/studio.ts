export type ArtifactType =
  | 'PODCAST'      // Exporta como: .mp3
  | 'QUIZ'         // Exporta como: .pdf (ou interativo)
  | 'FLASHCARD'    // Exporta como: .pdf (cartões para imprimir)
  | 'SUMMARY'      // Exporta como: .md / .pdf
  | 'SLIDE'        // Nome UI: "Apresentações". Exporta como: .pptx
  | 'SPREADSHEET'  // Nome UI: "Tabelas". Exporta como: .xlsx
  | 'WORKBOOK';    // Nome UI: "Apostila". Exporta como: .pdf

// Helper to get export format extension
export const getExportFormat = (type: ArtifactType) => {
  switch(type) {
    case 'SLIDE': return 'pptx';
    case 'SPREADSHEET': return 'xlsx';
    case 'WORKBOOK': return 'pdf';
    case 'PODCAST': return 'mp3';
    default: return 'pdf';
  }
};

export interface SlidePage {
  title: string;
  bullets: string[];
  image_prompt?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
  hint?: string;
}

export interface FlashcardItem {
  front: string;
  back: string;
}

export interface KnowledgeArtifact {
  id: number;
  chat: number;
  type: ArtifactType;
  title: string;
  status: 'processing' | 'ready' | 'error';
  media_url?: string; // snake_case to match backend
  duration?: string;
  score?: string;
  // Polymorphic content
  content?: SlidePage[] | QuizQuestion[] | FlashcardItem[] | string;
  created_at: string; // snake_case to match backend
}

export interface ContextSource {
    id: string; // The source name/filename or unique ID
    name: string;
    type: 'file' | 'kb';
    selected?: boolean;
}

export interface ArtifactGenerationOptions {
    quantity?: number;
    difficulty?: 'Easy' | 'Medium' | 'Hard';
    sourceIds?: string[];
    customInstructions?: string;
    targetDuration?: 'Short' | 'Medium' | 'Long';
}

// --- Library / Study Spaces ---

export interface StudySpace {
    id: number;
    title: string;
    description?: string;
    cover_image?: string;
    sources: ContextSource[]; // Reusing ContextSource or creating specific?
    bots: any[]; // Bot type from botService
    created_at: string;
}

export interface CreateSpaceParams {
    title: string;
    description?: string;
    coverImage?: any; // Helper for frontend form
    source_ids?: number[];
    bot_ids?: number[];
}
