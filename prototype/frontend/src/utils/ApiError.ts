/**
 * Frontend structured error class that mirrors the backend's error response shape.
 * Enables UI components to switch on machine-readable error codes for context-appropriate
 * messages and recovery actions.
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
