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

/**
 * Subscriber registry for cross-cutting concerns that need to inspect every
 * successful response body (e.g. surfacing `achievementUnlocks` envelopes
 * regardless of which endpoint produced them).
 *
 * This is the typed wrapper's equivalent of `axios.interceptors.response`,
 * with two important differences:
 *
 * 1. **Subscribers run after `response.data` is unwrapped.** Each callback
 *    receives the same `T` the awaited `api.get/post/...` call resolves to.
 *    Callers don't need to know about axios response envelopes.
 * 2. **Subscriber failures are isolated.** If a callback throws, it logs to
 *    the console and the original response still resolves cleanly. We never
 *    let an observer break the request flow.
 *
 * Use sparingly — most cross-cutting needs (auth headers, 401 redirects)
 * already live on the underlying `apiClient` and don't need to traverse the
 * typed wrapper.
 */
type ResponseSubscriber = (data: unknown, url: string, method: HttpMethod) => void;
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

const responseSubscribers = new Set<ResponseSubscriber>();

function emitResponse(data: unknown, url: string, method: HttpMethod): void {
  if (responseSubscribers.size === 0) return;
  for (const subscriber of responseSubscribers) {
    try {
      subscriber(data, url, method);
    } catch (subscriberError) {
      // Subscriber failures must never break the request flow. Log and continue.
      // Using console.warn directly (not the logger module) to avoid an import
      // cycle — `logger.ts` doesn't import this file but that could change.
      // eslint-disable-next-line no-console
      console.warn('[api] response subscriber threw:', subscriberError);
    }
  }
}

/**
 * Register a callback to run after every successful response. Returns an
 * unsubscribe function that removes the callback when invoked.
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = subscribeResponse((data) => {
 *     const unlocks = (data as { achievementUnlocks?: unknown[] })?.achievementUnlocks;
 *     if (Array.isArray(unlocks) && unlocks.length > 0) {
 *       // …surface a toast
 *     }
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 */
export function subscribeResponse(callback: ResponseSubscriber): () => void {
  responseSubscribers.add(callback);
  return () => {
    responseSubscribers.delete(callback);
  };
}

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
      emitResponse(response.data, url, 'get');
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
      emitResponse(response.data, url, 'post');
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
      emitResponse(response.data, url, 'put');
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
      emitResponse(response.data, url, 'patch');
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
      emitResponse(response.data, url, 'delete');
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },
};
