/**
 * Tests for the api.ts response subscriber system.
 *
 * The subscribeResponse / emitResponse pattern is used for achievement toast
 * notifications — if it breaks, players never see achievement unlocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient at module level
vi.mock('../apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from '../apiClient';
import { api, subscribeResponse } from '../api';

const mockedApiClient = vi.mocked(apiClient);

describe('api response subscribers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should invoke subscriber on successful GET', async () => {
    const responseData = { items: [1, 2, 3], achievementUnlocks: [{ id: 'test' }] };
    mockedApiClient.get.mockResolvedValue({ data: responseData });

    const subscriber = vi.fn();
    const unsubscribe = subscribeResponse(subscriber);

    await api.get('/api/test');

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith(responseData, '/api/test', 'get');

    unsubscribe();
  });

  it('should invoke subscriber on successful POST', async () => {
    const responseData = { success: true };
    mockedApiClient.post.mockResolvedValue({ data: responseData });

    const subscriber = vi.fn();
    const unsubscribe = subscribeResponse(subscriber);

    await api.post('/api/action', { body: 'data' });

    expect(subscriber).toHaveBeenCalledWith(responseData, '/api/action', 'post');

    unsubscribe();
  });

  it('should invoke subscriber on successful PUT', async () => {
    const responseData = { updated: true };
    mockedApiClient.put.mockResolvedValue({ data: responseData });

    const subscriber = vi.fn();
    const unsubscribe = subscribeResponse(subscriber);

    await api.put('/api/resource/1', { name: 'test' });

    expect(subscriber).toHaveBeenCalledWith(responseData, '/api/resource/1', 'put');

    unsubscribe();
  });

  it('should invoke subscriber on successful PATCH', async () => {
    const responseData = { patched: true };
    mockedApiClient.patch.mockResolvedValue({ data: responseData });

    const subscriber = vi.fn();
    const unsubscribe = subscribeResponse(subscriber);

    await api.patch('/api/resource/1', { name: 'updated' });

    expect(subscriber).toHaveBeenCalledWith(responseData, '/api/resource/1', 'patch');

    unsubscribe();
  });

  it('should invoke subscriber on successful DELETE', async () => {
    const responseData = { deleted: true };
    mockedApiClient.delete.mockResolvedValue({ data: responseData });

    const subscriber = vi.fn();
    const unsubscribe = subscribeResponse(subscriber);

    await api.delete('/api/resource/1');

    expect(subscriber).toHaveBeenCalledWith(responseData, '/api/resource/1', 'delete');

    unsubscribe();
  });

  it('should support multiple subscribers', async () => {
    mockedApiClient.get.mockResolvedValue({ data: { ok: true } });

    const sub1 = vi.fn();
    const sub2 = vi.fn();
    const unsub1 = subscribeResponse(sub1);
    const unsub2 = subscribeResponse(sub2);

    await api.get('/api/test');

    expect(sub1).toHaveBeenCalledTimes(1);
    expect(sub2).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });

  it('should not invoke unsubscribed subscriber', async () => {
    mockedApiClient.get.mockResolvedValue({ data: { ok: true } });

    const subscriber = vi.fn();
    const unsubscribe = subscribeResponse(subscriber);

    // Unsubscribe before the request
    unsubscribe();

    await api.get('/api/test');

    expect(subscriber).not.toHaveBeenCalled();
  });

  it('should isolate subscriber failures — one bad subscriber does not affect others', async () => {
    mockedApiClient.get.mockResolvedValue({ data: { value: 42 } });

    const badSubscriber = vi.fn(() => { throw new Error('subscriber crash'); });
    const goodSubscriber = vi.fn();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const unsub1 = subscribeResponse(badSubscriber);
    const unsub2 = subscribeResponse(goodSubscriber);

    // Should not throw even though badSubscriber throws
    const result = await api.get<{ value: number }>('/api/test');

    expect(result.value).toBe(42);
    expect(goodSubscriber).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalled();

    unsub1();
    unsub2();
    consoleSpy.mockRestore();
  });

  it('should not invoke subscribers on request failure', async () => {
    mockedApiClient.get.mockRejectedValue({
      response: { data: { error: 'Not found', code: 'NOT_FOUND' }, status: 404 },
    });

    const subscriber = vi.fn();
    const unsubscribe = subscribeResponse(subscriber);

    await expect(api.get('/api/missing')).rejects.toThrow();

    expect(subscriber).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('should allow same subscriber to be registered multiple times', async () => {
    mockedApiClient.get.mockResolvedValue({ data: { ok: true } });

    const subscriber = vi.fn();
    // Sets behave as expected — adding the same reference twice only adds it once
    const unsub1 = subscribeResponse(subscriber);
    const unsub2 = subscribeResponse(subscriber);

    await api.get('/api/test');

    // Set deduplication means it's only called once
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });
});
