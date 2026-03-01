import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import MockAdapter from 'axios-mock-adapter';
import apiClient from '../utils/apiClient';

/**
 * Property-based tests for API client interceptors
 * Feature: vps-migration
 *
 * Tests the request interceptor (JWT attachment) and
 * response interceptor (401 handling) of the centralized API client.
 */

describe('API Client Interceptors - Property Tests', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    vi.mocked(localStorage.getItem).mockReset();
    vi.mocked(localStorage.removeItem).mockReset();
    (window.location as unknown as { href: string }).href = '';
   
  });

  afterEach(() => {
    mock.restore();
  });

  /**
   * Property 4: JWT token attachment interceptor
   *
   * For any non-empty token string stored in localStorage, the API client
   * request interceptor should attach an `Authorization: Bearer <token>`
   * header to the outgoing request config.
   *
   * **Validates: Requirements 2.3**
   */
  describe('Property 4: JWT token attachment interceptor', () => {
    it('attaches Authorization: Bearer <token> header for any non-empty token', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          async (token) => {
            vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
              key === 'token' ? token : null,
            );

            mock.onGet('/api/test').reply(200, { ok: true });

            await apiClient.get('/api/test');

            const request = mock.history.get[0];
            expect(request).toBeDefined();
            expect(request.headers?.Authorization).toBe(`Bearer ${token}`);

            mock.resetHistory();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('does not attach Authorization header when no token is stored', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          vi.mocked(localStorage.getItem).mockReturnValue(null);

          mock.onGet('/api/test').reply(200, { ok: true });

          await apiClient.get('/api/test');

          const request = mock.history.get[0];
          expect(request).toBeDefined();
          expect(request.headers?.Authorization).toBeUndefined();

          mock.resetHistory();
        }),
        { numRuns: 5 },
      );
    });
  });

  /**
   * Property 5: 401 response clears authentication state
   *
   * For any 401 response, token is removed from localStorage and
   * redirect to /login occurs, regardless of the request URL or response body.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 5: 401 response clears authentication state', () => {
    it('clears token and redirects on 401 for any request path and response body', async () => {
      const pathArb = fc
        .stringMatching(/^[a-z][a-z0-9/\-_]*$/)
        .filter((s) => s.length >= 1 && s.length <= 50);

      const bodyArb = fc.oneof(
        fc.constant(null),
        fc.constant(''),
        fc.string(),
        fc.dictionary(fc.string(), fc.string()),
      );

      await fc.assert(
        fc.asyncProperty(pathArb, bodyArb, async (path, body) => {
          vi.mocked(localStorage.getItem).mockReturnValue('some-token');
          vi.mocked(localStorage.removeItem).mockClear();
          (window.location as unknown as { href: string }).href = '';

 

          mock.onAny(`/api/${path}`).reply(401, body);

          try {
            await apiClient.get(`/api/${path}`);
          } catch {
            // Expected: 401 causes rejection
          }

          expect(localStorage.removeItem).toHaveBeenCalledWith('token');
          expect(window.location.href).toBe('/login');

          mock.reset();
        }),
        { numRuns: 100 },
      );
    });

    it('does not clear token for non-401 error responses', async () => {
      const nonAuthStatusArb = fc.integer({ min: 400, max: 599 }).filter((s) => s !== 401);

      await fc.assert(
        fc.asyncProperty(nonAuthStatusArb, async (status) => {
          vi.mocked(localStorage.getItem).mockReturnValue('some-token');
          vi.mocked(localStorage.removeItem).mockClear();
          (window.location as unknown as { href: string }).href = '';

 

          mock.onGet('/api/test').reply(status, { error: 'some error' });

          try {
            await apiClient.get('/api/test');
          } catch {
            // Expected: error status causes rejection
          }

          expect(localStorage.removeItem).not.toHaveBeenCalled();
          expect(window.location.href).not.toBe('/login');

          mock.reset();
        }),
        { numRuns: 100 },
      );
    });
  });
});
