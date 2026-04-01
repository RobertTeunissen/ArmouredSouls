/**
 * Base error class for all application errors.
 *
 * Provides a structured error format with machine-readable codes, HTTP status codes,
 * and optional details. All domain-specific error classes (AuthError, RobotError, etc.)
 * should extend this class.
 *
 * The error middleware detects AppError instances via `instanceof` and formats them
 * into a consistent JSON response: `{ error, code, details? }`.
 *
 * @module errors/AppError
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  /**
   * Creates a new AppError instance.
   *
   * @param code - Machine-readable error code (e.g., 'ROBOT_NOT_FOUND')
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (default: 400)
   * @param details - Optional structured data (validation errors, etc.)
   */
  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Fix prototype chain for proper instanceof checks when extending built-in Error
    // This is required because TypeScript/ES6 class inheritance from built-ins
    // doesn't work correctly without this fix
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
