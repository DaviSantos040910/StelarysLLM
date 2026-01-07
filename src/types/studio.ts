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
