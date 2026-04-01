import apiClient from './apiClient';
import { ApiError } from './ApiError';
import { isAxiosError } from 'axios';

/**
 * Normalizes any error into an ApiError instance.
 * Handles structured backend errors, network errors, and unknown errors.
 */
function handleError(err: unknown): never {
  if (isAxiosError(err) && err.response) {
    const { data, status } = err.response;
    if (data && typeof data.code === 'string') {
      throw new ApiError(
        data.error || data.message || 'Request failed',
        data.code,
        status,
        data.details
      );
    }
    throw new ApiError(data?.error || 'Request failed', 'UNKNOWN_ERROR', status);
  }
  if (isAxiosError(err) && !err.response) {
    throw new ApiError('Network error', 'NETWORK_ERROR', 0);
  }
  throw new ApiError('Unknown error', 'UNKNOWN_ERROR', 0);
}

/**
 * Typed API helper that wraps apiClient and provides automatic
 * response unwrapping and error normalization.
 */
export const api = {
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await apiClient.get<T>(url, { params });
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },

  async post<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await apiClient.post<T>(url, data);
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },

  async put<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await apiClient.put<T>(url, data);
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },

  async delete<T>(url: string): Promise<T> {
    try {
      const response = await apiClient.delete<T>(url);
      return response.data;
    } catch (err) {
      handleError(err);
    }
  },
};
