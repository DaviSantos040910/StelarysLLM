export interface ApiErrorResult {
    isQuotaError: boolean;
    code?: string;
    message: string;
    meta?: any;
}

export const TRIAL_LIMIT_CODES = [
    'trial_tutor_limit',
    'trial_space_limit',
    'trial_message_limit', // assuming this might exist
];

export function parseApiError(error: any): ApiErrorResult {
    let result: ApiErrorResult = {
        isQuotaError: false,
        message: 'An unexpected error occurred.',
    };

    // If it's an Axios error or similar object with response.data
    const data = error?.response?.data || error;

    if (data) {
        // Extract message
        if (typeof data.detail === 'string') {
            result.message = data.detail;
        } else if (typeof data.message === 'string') {
            result.message = data.message;
        } else if (error.message) {
            result.message = error.message;
        }

        // Extract code and meta
        if (data.code) {
            result.code = data.code;
        }
        if (data.meta) {
            result.meta = data.meta;
        }

        // Check for Quota/Trial Error flags
        // 1. Explicit error: true with code
        if (data.error === true && data.code) {
             if (TRIAL_LIMIT_CODES.includes(data.code) || data.code.includes('limit')) {
                 result.isQuotaError = true;
             }
        }
        // 2. HTTP 402 or 422 with specific structure (handled by caller usually, but we parse body here)
        // If the caller passes the full axios error, we can check status too
        if (error?.response?.status === 402) {
            result.isQuotaError = true;
        }
        if (error?.response?.status === 422 && data.error === true) {
            result.isQuotaError = true;
        }
    } else if (error.message) {
        result.message = error.message;
    }

    return result;
}
