import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import apiClient from '../apiClient';
import { api } from '../api';
import { ApiError } from '../ApiError';

// Mock apiClient
vi.mock('../apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Type the mocked methods explicitly
const mockedGet = apiClient.get as Mock;
const mockedPost = apiClient.post as Mock;
const mockedPut = apiClient.put as Mock;
const mockedDelete = apiClient.delete as Mock;

// Helper to create AxiosError with proper structure
function createAxiosError(
  status: number | null,
  data?: unknown,
  message = 'Request failed'
): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const error = new AxiosError(
    message,
    status !== null ? 'ERR_BAD_REQUEST' : 'ERR_NETWORK',
    config,
    undefined,
    status !== null
      ? {
          status,
          statusText: 'Error',
          headers: {},
          config,
          data,
        }
      : undefined
  );

  return error;
}

describe('api helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('api.get', () => {
    describe('success path', () => {
      it('should return unwrapped response.data', async () => {
        const mockData = { id: 1, name: 'Test Robot' };
        mockedGet.mockResolvedValueOnce({ data: mockData });

        const result = await api.get<{ id: number; name: string }>('/api/robots/1');

        expect(result).toEqual(mockData);
        expect(mockedGet).toHaveBeenCalledWith('/api/robots/1', { params: undefined });
      });

      it('should pass params to apiClient', async () => {
        const mockData = [{ id: 1 }, { id: 2 }];
        mockedGet.mockResolvedValueOnce({ data: mockData });

        const result = await api.get('/api/robots', { limit: 10, offset: 0 });

        expect(result).toEqual(mockData);
        expect(mockedGet).toHaveBeenCalledWith('/api/robots', {
          params: { limit: 10, offset: 0 },
        });
      });

      it('should return array data correctly', async () => {
        const mockData = [
          { id: 1, name: 'Robot 1' },
          { id: 2, name: 'Robot 2' },
        ];
        mockedGet.mockResolvedValueOnce({ data: mockData });

        const result = await api.get<Array<{ id: number; name: string }>>('/api/robots');

        expect(result).toEqual(mockData);
        expect(result).toHaveLength(2);
      });
    });
  });

  describe('api.post', () => {
    describe('success path', () => {
      it('should return unwrapped response.data', async () => {
        const requestData = { name: 'New Robot' };
        const mockResponse = { id: 1, name: 'New Robot' };
        mockedPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.post<{ id: number; name: string }>('/api/robots', requestData);

        expect(result).toEqual(mockResponse);
        expect(mockedPost).toHaveBeenCalledWith('/api/robots', requestData);
      });

      it('should handle post without data', async () => {
        const mockResponse = { success: true };
        mockedPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.post('/api/action');

        expect(result).toEqual(mockResponse);
        expect(mockedPost).toHaveBeenCalledWith('/api/action', undefined);
      });
    });
  });

  describe('api.put', () => {
    describe('success path', () => {
      it('should return unwrapped response.data', async () => {
        const requestData = { name: 'Updated Robot' };
        const mockResponse = { id: 1, name: 'Updated Robot' };
        mockedPut.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.put<{ id: number; name: string }>('/api/robots/1', requestData);

        expect(result).toEqual(mockResponse);
        expect(mockedPut).toHaveBeenCalledWith('/api/robots/1', requestData);
      });

      it('should handle put without data', async () => {
        const mockResponse = { success: true };
        mockedPut.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.put('/api/robots/1/activate');

        expect(result).toEqual(mockResponse);
        expect(mockedPut).toHaveBeenCalledWith('/api/robots/1/activate', undefined);
      });
    });
  });

  describe('api.delete', () => {
    describe('success path', () => {
      it('should return unwrapped response.data', async () => {
        const mockResponse = { success: true, deletedId: 1 };
        mockedDelete.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.delete<{ success: boolean; deletedId: number }>('/api/robots/1');

        expect(result).toEqual(mockResponse);
        expect(mockedDelete).toHaveBeenCalledWith('/api/robots/1');
      });

      it('should handle empty response data', async () => {
        mockedDelete.mockResolvedValueOnce({ data: {} });

        const result = await api.delete('/api/robots/1');

        expect(result).toEqual({});
      });
    });
  });


  describe('structured error handling', () => {
    it('should throw ApiError with code and error from response body', async () => {
      const errorResponse = {
        code: 'ROBOT_NOT_FOUND',
        error: 'Robot with ID 999 not found',
      };
      const axiosError = createAxiosError(404, errorResponse);
      mockedGet.mockRejectedValueOnce(axiosError);

      try {
        await api.get('/api/robots/999');
        // Should not reach here
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('ROBOT_NOT_FOUND');
          expect(err.message).toBe('Robot with ID 999 not found');
          expect(err.statusCode).toBe(404);
        }
      }
    });

    it('should include details from structured error response', async () => {
      const errorResponse = {
        code: 'VALIDATION_ERROR',
        error: 'Validation failed',
        details: {
          fields: ['name', 'email'],
          messages: ['Name is required', 'Invalid email format'],
        },
      };
      const axiosError = createAxiosError(422, errorResponse);
      mockedPost.mockRejectedValueOnce(axiosError);

      try {
        await api.post('/api/users', { name: '' });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('VALIDATION_ERROR');
          expect(err.statusCode).toBe(422);
          expect(err.details).toEqual({
            fields: ['name', 'email'],
            messages: ['Name is required', 'Invalid email format'],
          });
        }
      }
    });

    it('should use message field if error field is not present', async () => {
      const errorResponse = {
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
      };
      const axiosError = createAxiosError(401, errorResponse);
      mockedGet.mockRejectedValueOnce(axiosError);

      try {
        await api.get('/api/protected');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.message).toBe('Authentication failed');
          expect(err.code).toBe('AUTH_FAILED');
        }
      }
    });

    it('should fallback to "Request failed" if no error or message field', async () => {
      const errorResponse = {
        code: 'SOME_ERROR',
      };
      const axiosError = createAxiosError(500, errorResponse);
      mockedGet.mockRejectedValueOnce(axiosError);

      try {
        await api.get('/api/something');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.message).toBe('Request failed');
          expect(err.code).toBe('SOME_ERROR');
        }
      }
    });

    it('should handle structured errors for all HTTP methods', async () => {
      const errorResponse = { code: 'FORBIDDEN', error: 'Access denied' };

      // Test POST
      mockedPost.mockRejectedValueOnce(createAxiosError(403, errorResponse));
      await expect(api.post('/api/admin')).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });

      // Test PUT
      mockedPut.mockRejectedValueOnce(createAxiosError(403, errorResponse));
      await expect(api.put('/api/admin/1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });

      // Test DELETE
      mockedDelete.mockRejectedValueOnce(createAxiosError(403, errorResponse));
      await expect(api.delete('/api/admin/1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    });
  });

  describe('network error handling', () => {
    it('should throw ApiError with NETWORK_ERROR code when no response', async () => {
      const axiosError = createAxiosError(null); // null status = no response
      mockedGet.mockRejectedValueOnce(axiosError);

      try {
        await api.get('/api/robots');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('NETWORK_ERROR');
          expect(err.message).toBe('Network error');
          expect(err.statusCode).toBe(0);
        }
      }
    });

    it('should handle network errors for all HTTP methods', async () => {
      const networkError = createAxiosError(null);

      // Test GET
      mockedGet.mockRejectedValueOnce(networkError);
      await expect(api.get('/api/test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        statusCode: 0,
      });

      // Test POST
      mockedPost.mockRejectedValueOnce(networkError);
      await expect(api.post('/api/test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        statusCode: 0,
      });

      // Test PUT
      mockedPut.mockRejectedValueOnce(networkError);
      await expect(api.put('/api/test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        statusCode: 0,
      });

      // Test DELETE
      mockedDelete.mockRejectedValueOnce(networkError);
      await expect(api.delete('/api/test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        statusCode: 0,
      });
    });
  });

  describe('unknown error handling', () => {
    it('should throw ApiError with UNKNOWN_ERROR when response has no structured error shape', async () => {
      const errorResponse = { someOtherField: 'value' }; // No 'code' field
      const axiosError = createAxiosError(500, errorResponse);
      mockedGet.mockRejectedValueOnce(axiosError);

      try {
        await api.get('/api/robots');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('UNKNOWN_ERROR');
          expect(err.statusCode).toBe(500);
        }
      }
    });

    it('should use error field from response if available for unknown errors', async () => {
      const errorResponse = { error: 'Something went wrong' }; // Has error but no code
      const axiosError = createAxiosError(500, errorResponse);
      mockedGet.mockRejectedValueOnce(axiosError);

      try {
        await api.get('/api/robots');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('UNKNOWN_ERROR');
          expect(err.message).toBe('Something went wrong');
        }
      }
    });

    it('should handle null response data', async () => {
      const axiosError = createAxiosError(500, null);
      mockedGet.mockRejectedValueOnce(axiosError);

      try {
        await api.get('/api/robots');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('UNKNOWN_ERROR');
          expect(err.message).toBe('Request failed');
        }
      }
    });

    it('should handle undefined response data', async () => {
      const axiosError = createAxiosError(500, undefined);
      mockedGet.mockRejectedValueOnce(axiosError);

      try {
        await api.get('/api/robots');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('UNKNOWN_ERROR');
        }
      }
    });

    it('should handle non-AxiosError exceptions', async () => {
      const regularError = new Error('Something unexpected');
      mockedGet.mockRejectedValueOnce(regularError);

      try {
        await api.get('/api/robots');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('UNKNOWN_ERROR');
          expect(err.message).toBe('Unknown error');
          expect(err.statusCode).toBe(0);
        }
      }
    });

    it('should handle string thrown as error', async () => {
      mockedGet.mockRejectedValueOnce('string error');

      try {
        await api.get('/api/robots');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('UNKNOWN_ERROR');
        }
      }
    });

    it('should handle code field that is not a string', async () => {
      const errorResponse = { code: 123, error: 'Numeric code' }; // code is number, not string
      const axiosError = createAxiosError(400, errorResponse);
      mockedGet.mockRejectedValueOnce(axiosError);

      try {
        await api.get('/api/robots');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.code).toBe('UNKNOWN_ERROR'); // Falls through because code is not a string
        }
      }
    });
  });

  describe('type safety', () => {
    it('should preserve generic type for successful responses', async () => {
      interface Robot {
        id: number;
        name: string;
        health: number;
      }

      const mockRobot: Robot = { id: 1, name: 'Test', health: 100 };
      mockedGet.mockResolvedValueOnce({ data: mockRobot });

      const result = await api.get<Robot>('/api/robots/1');

      // TypeScript would catch type mismatches at compile time
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test');
      expect(result.health).toBe(100);
    });
  });
});
