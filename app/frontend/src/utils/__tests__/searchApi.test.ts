import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { search } from '../searchApi';
import type { SearchResponse } from '../searchTypes';

vi.mock('../api', () => ({
  api: { get: vi.fn() },
}));

const mockedGet = vi.mocked(api.get);

const SEARCH_RESPONSE: SearchResponse = {
  robots: [
    {
      category: 'robots',
      id: 12,
      label: 'Atlas',
      subtitle: 'North Star Stable',
    },
  ],
  stables: [
    {
      category: 'stables',
      userId: 34,
      label: 'North Star Stable',
    },
  ],
  guide: [
    {
      category: 'guide',
      title: 'Robot Setup',
      sectionTitle: 'Getting Started',
      sectionSlug: 'getting-started',
      articleSlug: 'robot-setup',
    },
  ],
};

describe('searchApi', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('requests all MVP categories through the single search endpoint', async () => {
    const signal = new AbortController().signal;
    mockedGet.mockResolvedValueOnce(SEARCH_RESPONSE);

    await expect(search('  atlas  ', signal)).resolves.toBe(SEARCH_RESPONSE);

    expect(mockedGet).toHaveBeenCalledWith('/api/search', {
      params: { q: '  atlas  ' },
      signal,
    });
  });

  it('does not add history, identity, selection, or analytics request fields', async () => {
    mockedGet.mockResolvedValueOnce(SEARCH_RESPONSE);

    await search('atlas');

    expect(mockedGet).toHaveBeenCalledWith('/api/search', {
      params: { q: 'atlas' },
      signal: undefined,
    });
    expect(mockedGet.mock.calls[0]?.[1]).not.toHaveProperty('params.history');
    expect(mockedGet.mock.calls[0]?.[1]).not.toHaveProperty('params.userId');
    expect(mockedGet.mock.calls[0]?.[1]).not.toHaveProperty('params.selection');
    expect(mockedGet.mock.calls[0]?.[1]).not.toHaveProperty('params.analytics');
  });
});
