const SEARCH_ENDPOINT_PATH = '/api/search';

/**
 * Return the path used in diagnostics without exposing a search query.
 *
 * Only the search endpoint is sanitized. Other routes retain their existing
 * request URL, including query parameters, so this helper does not change
 * unrelated diagnostics.
 */
export function safeRequestPath(originalUrl: string): string {
  const queryStart = originalUrl.indexOf('?');
  const path = queryStart === -1 ? originalUrl : originalUrl.slice(0, queryStart);

  return path === SEARCH_ENDPOINT_PATH ? SEARCH_ENDPOINT_PATH : originalUrl;
}
