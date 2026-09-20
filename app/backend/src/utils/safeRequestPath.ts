const SEARCH_ENDPOINT_PATH = '/api/search';
const MAX_PATH_DECODING_PASSES = 2;

function decodePathSafely(path: string): string {
  let decoded = path;

  for (let pass = 0; pass < MAX_PATH_DECODING_PASSES; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return decoded;
    }
  }

  return decoded;
}

/**
 * Canonicalize a request path without ever retaining a search query or hash.
 *
 * Search requests are recognized across routing-equivalent variants such as
 * duplicate/trailing slashes and percent-encoded path separators. Malformed
 * encodings remain safe because the raw URL is never returned once its decoded
 * path identifies the search endpoint.
 */
function canonicalPath(originalUrl: string): string {
  const beforeFragment = originalUrl.split('#', 1)[0] ?? originalUrl;
  const rawPath = beforeFragment.split('?', 1)[0] ?? beforeFragment;
  const decodedPath = decodePathSafely(rawPath);
  const withoutEncodedQuery = decodedPath.split(/[?#]/, 1)[0] ?? decodedPath;
  const normalizedSlashes = withoutEncodedQuery.replace(/\\+/g, '/').replace(/\/+/g, '/');
  const trimmed = normalizedSlashes.replace(/\/+$/, '');

  return trimmed || '/';
}

/**
 * Return the path used in diagnostics without exposing a search query.
 *
 * Only the search endpoint is sanitized. Other routes retain their existing
 * request URL, including query parameters, so this helper does not change
 * unrelated diagnostics.
 */
export function safeRequestPath(originalUrl: string): string {
  return canonicalPath(originalUrl) === SEARCH_ENDPOINT_PATH
    ? SEARCH_ENDPOINT_PATH
    : originalUrl;
}
