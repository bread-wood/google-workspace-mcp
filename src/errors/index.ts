import { logger } from '../logger.js';

export class ToolError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly cause?: unknown,
  ) {
    super(userMessage);
    this.name = 'ToolError';
  }
}

interface GoogleApiError {
  code?: number;
  message?: string;
  errors?: Array<{ message?: string; reason?: string }>;
}

function isGoogleApiError(err: unknown): err is { response?: { status?: number; data?: { error?: GoogleApiError } } } {
  return typeof err === 'object' && err !== null && 'response' in err;
}

function extractGoogleError(err: unknown): { status: number; message: string } | null {
  if (!isGoogleApiError(err)) return null;
  const status = err.response?.status;
  const apiError = err.response?.data?.error;
  if (typeof status !== 'number') return null;
  return {
    status,
    message: apiError?.message || 'Unknown Google API error',
  };
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check the input parameters.',
  401: 'Authentication expired. Use the auth_status tool to re-authenticate.',
  403: 'Permission denied. The requested scope may not be authorized.',
  404: 'Resource not found. Please verify the ID is correct.',
  429: 'Rate limit exceeded. Please wait before retrying.',
  500: 'Google API internal error. Please try again.',
  503: 'Google API temporarily unavailable. Please try again later.',
};

export function mapError(err: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  // Log full error for debugging (to stderr only)
  logger.error('Tool error', {
    name: err instanceof Error ? err.name : 'unknown',
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  // Return safe message to LLM
  let userMessage: string;

  if (err instanceof ToolError) {
    userMessage = err.userMessage;
  } else {
    const googleErr = extractGoogleError(err);
    if (googleErr) {
      userMessage = STATUS_MESSAGES[googleErr.status] || `Google API error (${googleErr.status}). Please try again.`;
    } else if (err instanceof Error) {
      // Generic error — don't expose internals
      userMessage = 'An unexpected error occurred. Check server logs for details.';
    } else {
      userMessage = 'An unexpected error occurred.';
    }
  }

  return {
    content: [{ type: 'text', text: userMessage }],
    isError: true,
  };
}
