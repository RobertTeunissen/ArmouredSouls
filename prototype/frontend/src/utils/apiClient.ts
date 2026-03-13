import axios from 'axios';

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
        console.warn('Non-backend 401/403 received (possible proxy/WAF block), keeping session:', status, url);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
