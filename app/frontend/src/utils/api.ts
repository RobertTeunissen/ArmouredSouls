import apiClient from './apiClient';
import { ApiError } from './ApiError';
import { isAxiosError } from 'axios';
import type { AxiosRequestConfig } from 'axios';

/**
 * Typed API helper. Wraps `apiClient` (axios) with three guarantees:
 *
 * 1. **Returns unwrapped data**, not `AxiosResponse`. Callers write
 *    `const user = await api.get<User>('/me')` instead of
 *    `const { data: user } = await apiClient.get<User>('/me')`.
 * 2. **Throws `ApiError`**, not raw axios errors. Callers can `instanceof`
 *    check and read `.statusCode` / `.code` / `.details` without poking at
 *    `error.response.data.something`.
 * 3. **Backend error shape preserved.** When the backend returns a structured
 *    `{ error, code, details? }`, those are surfaced on the `ApiError`. When
 *    it returns a plain string body, falls back to `'UNKNOWN_ERROR'`.
 *
 * Per-request config (`headers`, `params`, `responseType`, etc.) is forwarded
 * to axios — needed for FormData uploads and download endpoints. For most
 * calls the second argument can be omitted.
 *
 * @see {@link ./apiClient} for the underlying axios instance (interceptors,
 *      JWT injection, 401 redirect logic).
 * @see {@link ./ApiError} for the structured error type thrown by every
 *      method here.
 */

/**
 * Per-request config. Subset of `AxiosRequestConfig` exposed intentionally —
 * we don't want callers reaching for axios internals or interceptors.
 */
export interface ApiRequestConfig {
  /** Query string parameters. Same semantics as axios `params`. */
  params?: Record<string, unknown>;
  /** Custom headers, merged with axios defaults. */
  headers?: Record<string, string>;
  /** Override response type (e.g. `'blob'` for binary downloads). */
  responseType?: AxiosRequestConfig['responseType'];
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

/**
 * Normalize any thrown value into an {@link ApiError}. Backend payloads with
 * a `code` property are preserved; otherwise the error is tagged
 * `UNKNOWN_ERROR` (with the response status) or `NETWORK_ERROR` (no response).
 *
 * Accepts both real `AxiosError` instances and shape-compatible objects
 * (`{ response: { data, status } }`). The duck-typed path is what unit tests
 * use when mocking `apiClient.get/post/...` rejections — making the wrapper
 * handle both keeps the test surface ergonomic without requiring callers to
 * construct real `AxiosError`s.
 *
 * **Message semantics:** When the backend supplies an `error` or `message`
 * field, it's preserved on the `ApiError`. When it doesn't (or the failure
 * is a network/transport issue), `ApiError.message` is set to the empty
 * string so callers can confidently fall back to a domain-specific copy via
 * `err.message || 'Failed to load …'`. We intentionally avoid filling the
 * message with "Unknown error" / "Request failed" placeholders because UI
 * surfaces would otherwise display those raw strings.
 */
function handleError(err: unknown): never {
  // Real AxiosError, or anything shape-compatible with one.
  const candidate = err as {
    response?: { data?: { error?: string; message?: string; code?: string; details?: unknown }; status?: number };
    request?: unknown;
    isAxiosError?: boolean;
  } | null;

  if (candidate && typeof candidate === 'object' && candidate.response) {
    const data = candidate.response.data;
    const status = candidate.response.status ?? 0;
    const message = (data && (data.error || data.message)) || '';
    if (data && typeof data.code === 'string') {
      throw new ApiError(message, data.code, status, data.details);
    }
    throw new ApiError(message, 'UNKNOWN_ERROR', status);
  }

  // No `response` but is an axios error → network failure.
  if (isAxiosError(err) && !err.response) {
    throw new ApiError('', 'NETWORK_ERROR', 0);
  }

  // Anything else (test-mocked bare Errors, thrown strings, unknown values)
  // → opaque unknown error. We deliberately drop the original message
  // because, without a backend response shape, there's no signal that the
  // string is safe to render in the UI. Callers fall back via
  // `err.message || 'Failed to …'`.
  throw new ApiError('', 'UNKNOWN_ERROR', 0);
}

const buildAxiosConfig = (config?: ApiRequestConfig): AxiosRequestConfig | undefined => {
  if (!config) return undefined;
  const out: AxiosRequestConfig = {};
  if (config.params !== undefined) out.params = config.params;
  if (config.headers !== undefined) out.headers = config.headers;
  if (config.responseType !== undefined) out.responseType = config.responseType;
  if (config.signal !== undefined) out.signal = config.signal;
  return out;
};

export const api = {
  async get<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    try {
      // Pass only the args that were actually supplied so test assertions
      // matching `[url]` or `[url, config]` keep working without explicit
      // `undefined` placeholders.
      const axiosConfig = buildAxiosConfig(config);
      const response = axiosConfig
        ? await apiClient.get<T>(url, axiosConfig)
        : await apiClient.get<T>(url);
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },

  async post<T>(url: string, data?: unknown, config?: ApiRequestConfig): Promise<T> {
    try {
      const axiosConfig = buildAxiosConfig(config);
      let response;
      if (axiosConfig) {
        response = await apiClient.post<T>(url, data, axiosConfig);
      } else if (data !== undefined) {
        response = await apiClient.post<T>(url, data);
      } else {
        response = await apiClient.post<T>(url);
      }
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },

  async put<T>(url: string, data?: unknown, config?: ApiRequestConfig): Promise<T> {
    try {
      const axiosConfig = buildAxiosConfig(config);
      let response;
      if (axiosConfig) {
        response = await apiClient.put<T>(url, data, axiosConfig);
      } else if (data !== undefined) {
        response = await apiClient.put<T>(url, data);
      } else {
        response = await apiClient.put<T>(url);
      }
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },

  async patch<T>(url: string, data?: unknown, config?: ApiRequestConfig): Promise<T> {
    try {
      const axiosConfig = buildAxiosConfig(config);
      let response;
      if (axiosConfig) {
        response = await apiClient.patch<T>(url, data, axiosConfig);
      } else if (data !== undefined) {
        response = await apiClient.patch<T>(url, data);
      } else {
        response = await apiClient.patch<T>(url);
      }
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },

  async delete<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    try {
      const axiosConfig = buildAxiosConfig(config);
      const response = axiosConfig
        ? await apiClient.delete<T>(url, axiosConfig)
        : await apiClient.delete<T>(url);
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },
};
