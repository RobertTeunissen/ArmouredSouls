/**
 * Identify expected request cancellation without treating it as a user-visible
 * failure. The signal check covers native AbortController cancellation; the
 * shape checks cover DOMException, Axios, fetch, and test-double variants.
 */
export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
  };

  if (candidate.name === 'AbortError' || candidate.name === 'CanceledError') return true;
  if (candidate.code === 'ERR_CANCELED' || candidate.code === 'ABORT_ERR') return true;
  return candidate.message === 'canceled' || candidate.message === 'aborted';
}
