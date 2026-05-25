import axios from 'axios';
import { createLogger } from './logger';

const log = createLogger('apiClient');

/**
 * Raw axios instance used as the implementation detail of the typed `api`
 * wrapper in {@link ./api}. **Do not import this module from anywhere else
 * in production code.** Use `api` for typed requests; if you need to react
 * to every successful response, use `subscribeResponse` from `api.ts`.
 *
 * The instance hosts two interceptors that must run on the underlying axios
 * layer (not at the wrapper boundary):
 *
 * 1. **Request — JWT injection.** Reads the `token` from `localStorage` and
 *    attaches it as `Authorization: Bearer <token>`.
 * 2. **Response — auth failure handling.** On 401/403 from a non-auth
 *    route, distinguishes "backend says your token is bad" (clear token
 *    and redirect to login) from "a proxy/WAF blocked this request" (keep
 *    the session intact). Auth route 401s are passed through so login
 *    forms can render their own error.
 *
 * Test files are allowed to mock this module via `vi.mock('../apiClient')`
 * so they can intercept the actual axios calls the wrapper makes. Outside
 * of tests, an ESLint rule blocks direct imports of this file.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
});

// Request interceptor: attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle auth failures for authenticated routes only.
// Auth endpoints (login/register) return 401 for invalid credentials,
// which should be handled by the calling component, not by a redirect.
// Network errors (no response) are NOT treated as auth failures.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthRoute = url.includes('/api/auth/');
    const status = error.response?.status;

    // Only clear token and redirect on definitive auth failures from our
    // own backend. Proxy/WAF/DDoS layers (Cloudflare, Caddy, etc.) may
    // also return 403, but those responses won't contain our JSON error
    // format. We distinguish "backend says your token is bad" from
    // "a proxy blocked this request" by checking the response body shape.
    if ((status === 401 || status === 403) && !isAuthRoute) {
      const data = error.response?.data;
      const isBackendAuthError =
        data && typeof data === 'object' && typeof data.error === 'string';

      if (isBackendAuthError) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        // Proxy/WAF block — don't destroy the session. The token may
        // still be perfectly valid; the request was just rejected upstream.
        log.warn('Non-backend 401/403 received (possible proxy/WAF block), keeping session', { status, url });
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
