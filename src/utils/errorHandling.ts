// src/utils/errorHandling.ts
// Centralized error handling utilities for common backend responses.

/**
 * Checks if an error is a rate-limit (429) response.
 */
export function isRateLimited(error: any): boolean {
    return error?.response?.status === 429;
}

/**
 * Returns a user-facing message for rate-limited requests.
 */
export function getRateLimitMessage(): string {
    return 'Muitas tentativas. Tente novamente em 1 minuto.';
}

/**
 * Extracts user-friendly error message from API error responses.
 * Handles:
 * - detail as string
 * - detail as array of strings (Django password validators, etc.)
 * - Fallbacks to a default message
 */
export function extractApiError(error: any, fallback: string = 'Ocorreu um erro. Tente novamente.'): string {
    if (isRateLimited(error)) {
        return getRateLimitMessage();
    }

    const data = error?.response?.data;
    if (!data) return fallback;

    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.join('\n');
    if (typeof data.message === 'string') return data.message;

    return fallback;
}

/**
 * Minimum password length enforced by backend Django validators.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Validates password locally before sending to backend.
 * Returns error message or null if valid.
 */
export function validatePasswordLocally(password: string): string | null {
    if (password.length < MIN_PASSWORD_LENGTH) {
        return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    return null;
}
