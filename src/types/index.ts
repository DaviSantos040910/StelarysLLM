export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  avatar_url?: string;
}

export interface Workspace { // Antigo "Bot"
  id: string; // UUID
  name: string;
  description?: string;
  category_id?: string; // ex: 'productivity'
  icon?: string; // Mapear no front
  files_count: number;
  allow_web_search: boolean;
}

export interface Message {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  attachment?: string; // URL do arquivo
  attachment_type?: 'image' | 'file' | 'audio';
  duration?: number; // Se for áudio
}

export interface StudyFile {
  id: number;
  file_name: string;      // Nome exibido (ex: "Lecture_01.pdf")
  file_url: string;       // Link direto para download/visualização
  file_type: 'pdf' | 'docx' | 'txt';
  created_at: string;
}
