/**
 * IPC Error Handling Middleware
 * Provides consistent error handling and logging for IPC operations
 */

export interface IpcError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standard error codes
 */
export enum IpcErrorCode {
  // Archive errors
  ARCHIVE_NOT_FOUND = 'ARCHIVE_NOT_FOUND',
  ARCHIVE_CORRUPTED = 'ARCHIVE_CORRUPTED',
  ARCHIVE_PASSWORD_REQUIRED = 'ARCHIVE_PASSWORD_REQUIRED',
  ARCHIVE_PASSWORD_INCORRECT = 'ARCHIVE_PASSWORD_INCORRECT',
  ARCHIVE_UNSUPPORTED_FORMAT = 'ARCHIVE_UNSUPPORTED_FORMAT',

  // Image errors
  IMAGE_NOT_FOUND = 'IMAGE_NOT_FOUND',
  IMAGE_CORRUPTED = 'IMAGE_CORRUPTED',
  IMAGE_LOAD_FAILED = 'IMAGE_LOAD_FAILED',

  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_SAVE_FAILED = 'SESSION_SAVE_FAILED',

  // Bookmark errors
  BOOKMARK_NOT_FOUND = 'BOOKMARK_NOT_FOUND',
  BOOKMARK_SAVE_FAILED = 'BOOKMARK_SAVE_FAILED',
  BOOKMARK_DELETE_FAILED = 'BOOKMARK_DELETE_FAILED',

  // Generic errors
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Create a standardized IPC error
 */
export function createIpcError(
  code: IpcErrorCode | string,
  message: string,
  details?: unknown
): IpcError {
  return {
    code,
    message,
    details,
  };
}

/**
 * Wrap an IPC handler with error handling
 */
export function withErrorHandling<T>(
  handler: (...args: unknown[]) => Promise<T> | T
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]): Promise<T> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Log the error
      console.error('IPC handler error:', error);

      // Re-throw as IpcError if not already
      if (isIpcError(error)) {
        throw error;
      }

      // Convert to IpcError
      if (error instanceof Error) {
        throw createIpcError(
          IpcErrorCode.INTERNAL_ERROR,
          error.message,
          error.stack
        );
      }

      // Unknown error type
      throw createIpcError(
        IpcErrorCode.UNKNOWN_ERROR,
        'An unknown error occurred',
        error
      );
    }
  };
}

/**
 * Check if an error is an IpcError
 */
export function isIpcError(error: unknown): error is IpcError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Log IPC errors with context
 */
export function logIpcError(channel: string, error: unknown): void {
  if (isIpcError(error)) {
    console.error(`[IPC Error] ${channel}:`, {
      code: error.code,
      message: error.message,
      details: error.details,
    });
  } else {
    console.error(`[IPC Error] ${channel}:`, error);
  }
}
