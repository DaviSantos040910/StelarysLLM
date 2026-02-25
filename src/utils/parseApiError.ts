import { router } from 'expo-router';
// We use a dynamic require for store to avoid circular deps if this util is used in store
// But for cleaner code, we can import store if it's safe.
// However, client.ts had circular dep issues, so let's stick to safe dynamic import or pass store state.

// Standard error response interface from backend
export interface ApiErrorResponse {
  error: boolean;
  code: string;
  message: string;
  meta?: any;
}

export const isApiErrorResponse = (data: any): data is ApiErrorResponse => {
  return data && typeof data === 'object' && data.error === true && typeof data.code === 'string';
};

/**
 * Checks if the error code corresponds to a trial/quota limit.
 */
export const isLimitError = (code: string): boolean => {
  return (
    code === 'trial_tutor_limit' ||
    code === 'trial_study_space_limit' ||
    code === 'trial_message_limit' ||
    code.includes('limit') ||
    code.includes('quota')
  );
};

/**
 * Handles redirection for limit errors.
 * Returns true if redirected, false otherwise.
 */
export const handleLimitError = (code: string): boolean => {
  if (isLimitError(code)) {
    try {
      // Dynamic import to avoid circular dependency cycles
      const { useAuthStore } = require('../stores/authStore');
      const { isAuthenticated } = useAuthStore.getState();

      if (!isAuthenticated) {
        router.replace({
          pathname: '/(auth)/login',
          params: { redirectTo: '/plans' }
        });
      } else {
        router.replace('/plans');
      }
      return true;
    } catch (e) {
      console.error("Navigation failed in handleLimitError", e);
    }
  }
  return false;
};

/**
 * Parses a fetch Response and throws a structured error if it fails.
 * Automatically handles limit redirects.
 */
export const parseApiError = async (response: Response): Promise<void> => {
  if (!response.ok) {
    let errorData: any = {};
    const text = await response.text();

    try {
        errorData = JSON.parse(text);
    } catch (e) {
        // Not JSON, use text as message
        throw new Error(text || `Request failed with status ${response.status}`);
    }

    // Check for structured API error
    if (isApiErrorResponse(errorData)) {
        if (handleLimitError(errorData.code)) {
            // If redirected, throw a friendly error to stop execution
            throw new Error(errorData.message || 'Limite atingido. Redirecionando...');
        }
        throw new Error(errorData.message);
    }

    // Fallback: Check strictly for 422 with typical limit structures even if not fully adhering to ApiErrorResponse
    if (response.status === 422) {
        // Sometimes detail might contain the code or message
        if (errorData.code && handleLimitError(errorData.code)) {
             throw new Error(errorData.message || 'Limite atingido. Redirecionando...');
        }
    }

    // Standard DRF error handling (detail or field errors)
    let errorMessage = errorData.detail || errorData.message || "Request failed";

    if (!errorData.detail && !errorData.message) {
        // Flatten field errors
         const fieldErrors = Object.entries(errorData).map(([key, val]) => {
             const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
             return `${key}: ${valStr}`;
         }).join(', ');
         if (fieldErrors) errorMessage = fieldErrors;
    }

    throw new Error(errorMessage);
  }
};
