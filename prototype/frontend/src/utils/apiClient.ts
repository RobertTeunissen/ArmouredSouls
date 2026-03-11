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

    // Only clear token and redirect on definitive auth failures (401/403)
    // from non-auth routes. Network errors (no response) should not trigger logout.
    if ((status === 401 || status === 403) && !isAuthRoute) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
