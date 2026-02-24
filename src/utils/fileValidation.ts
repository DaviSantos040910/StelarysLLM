// src/utils/fileValidation.ts
// Centralized file validation aligned with backend upload policy.

export const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a',
    'audio/wav',
    'audio/x-m4a',
    'audio/webm',
    'video/mp4',
];

export interface FileInfo {
    size?: number;
    type?: string;
    mimeType?: string;
    name?: string;
}

/**
 * Validates a file against backend upload constraints.
 * Returns a user-friendly error message string, or null if valid.
 */
export function validateFile(file: FileInfo): string | null {
    const fileName = file.name || 'arquivo';
    const fileSize = file.size;
    const fileMime = file.mimeType || file.type;

    if (fileSize && fileSize > MAX_UPLOAD_SIZE) {
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
        return `Arquivo "${fileName}" excede o limite de 25MB (${sizeMB}MB).`;
    }

    if (fileMime && !ALLOWED_MIME_TYPES.includes(fileMime)) {
        return `Tipo de arquivo não permitido: ${fileMime}`;
    }

    return null; // Valid
}

/**
 * Extracts a user-friendly error message from a backend error response.
 * Handles both string and array `detail` fields.
 */
export function extractUploadError(error: any): string {
    const data = error?.response?.data;
    if (!data) return 'Erro ao enviar arquivo.';

    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.join('\n');

    return 'Erro ao enviar arquivo.';
}
