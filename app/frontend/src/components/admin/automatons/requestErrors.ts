/**
 * Messages of rejected admin requests (Spec #55, task 10.2): the backend
 * message (`ApiError.message`) and the rule messages in `details.issues`.
 */

/** Error text of a failed admin request: the backend message, else a fallback. */
export function errorText(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    const message = (error as { message: string }).message;
    if (message) return message;
  }
  return fallback;
}

/** The `details.issues` messages of a rejected request (catalogue and strategy rules). */
export function issueMessages(error: unknown): string[] {
  const details = (error as { details?: { issues?: { message?: unknown }[] } } | null)?.details;
  return (details?.issues ?? []).flatMap((issue) => (typeof issue.message === 'string' ? [issue.message] : []));
}
