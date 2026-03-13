import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GuideSearch, { filterAndRankResults } from '../../components/guide/GuideSearch';
import * as guideApi from '../../utils/guideApi';

vi.mock('../../utils/guideApi', async () => {
  const actual = await vi.importActual<typeof guideApi>('../../utils/guideApi');
  return {
    ...actual,
    fetchSearchIndex: vi.fn(),
  };
});

const mockSearchIndex: guideApi.SearchIndexEntry[] = [
  {
    slug: 'battle-flow',
    title: 'Battle Flow',
    sectionSlug: 'combat',
    sectionTitle: 'Combat',
    description: 'How battles work',
    bodyText: 'When a robot attacks the game processes several steps in order',
  },
  {
    slug: 'credits',
    title: 'Credits & Income',
    sectionSlug: 'economy',
    sectionTitle: 'Economy & Finances',
    description: 'Currency system',
    bodyText: 'Credits are the primary currency in Armoured Souls',
  },
  {
    slug: 'stances',
    title: 'Stances',
    sectionSlug: 'combat',
    sectionTitle: 'Combat',
    description: 'Stance modifiers',
    bodyText: 'Offensive defensive and balanced stances modify combat attributes',
  },
];

function renderSearch(onResultSelect = vi.fn()): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <GuideSearch onResultSelect={onResultSelect} />
    </MemoryRouter>
  );
}

describe('GuideSearch — filterAndRankResults (unit)', () => {
  it('should return empty array for queries shorter than 2 characters', () => {
    const results = filterAndRankResults(mockSearchIndex, 'b');
    expect(results).toHaveLength(0);
  });

  it('should return empty array for empty query', () => {
    const results = filterAndRankResults(mockSearchIndex, '');
    expect(results).toHaveLength(0);
  });

  it('should match title entries and rank them first', () => {
    const results = filterAndRankResults(mockSearchIndex, 'Battle');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Battle Flow');
    expect(results[0].matchType).toBe('title');
  });

  it('should match section title entries', () => {
    // "Combat" matches sectionTitle for battle-flow and stances
    const results = filterAndRankResults(mockSearchIndex, 'Combat');
    const sectionMatches = results.filter(r => r.matchType === 'section');
    expect(sectionMatches.length).toBeGreaterThan(0);
  });

  it('should match body text entries', () => {
    const results = filterAndRankResults(mockSearchIndex, 'robot');
    const bodyMatches = results.filter(r => r.matchType === 'body');
    expect(bodyMatches.length).toBeGreaterThan(0);
  });

  it('should rank title matches before section matches before body matches', () => {
    // "Stances" matches title for stances, and body for stances (title takes priority)
    // Use a query that hits all three match types
    const entries: guideApi.SearchIndexEntry[] = [
      { slug: 'a', title: 'Alpha Test', sectionSlug: 's1', sectionTitle: 'Section One', description: '', bodyText: 'no match here' },
      { slug: 'b', title: 'Beta', sectionSlug: 's2', sectionTitle: 'Alpha Section', description: '', bodyText: 'no match' },
      { slug: 'c', title: 'Gamma', sectionSlug: 's3', sectionTitle: 'Other', description: '', bodyText: 'contains alpha word' },
    ];

    const results = filterAndRankResults(entries, 'Alpha');
    expect(results).toHaveLength(3);
    expect(results[0].matchType).toBe('title');
    expect(results[1].matchType).toBe('section');
    expect(results[2].matchType).toBe('body');
  });

  it('should return no results when query matches nothing', () => {
    const results = filterAndRankResults(mockSearchIndex, 'zzzzz');
    expect(results).toHaveLength(0);
  });

  it('should perform case-insensitive matching', () => {
    const results = filterAndRankResults(mockSearchIndex, 'battle');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Battle Flow');
  });
});

describe('GuideSearch — Component', () => {
  beforeEach(() => {
    vi.mocked(guideApi.fetchSearchIndex).mockResolvedValue(mockSearchIndex);
  });

  it('should render the search input', () => {
    renderSearch();
    expect(screen.getByLabelText('Search guide')).toBeInTheDocument();
  });

  it('should fetch search index on first focus', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByLabelText('Search guide');
    await user.click(input);

    await waitFor(() => {
      expect(guideApi.fetchSearchIndex).toHaveBeenCalledTimes(1);
    });
  });

  it('should show "No results found" when query matches nothing', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByLabelText('Search guide');
    await user.click(input);

    await waitFor(() => {
      expect(guideApi.fetchSearchIndex).toHaveBeenCalled();
    });

    await user.type(input, 'zzzzz');

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  it('should show "Search unavailable" and disable input when index fetch fails', async () => {
    vi.mocked(guideApi.fetchSearchIndex).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByLabelText('Search guide');
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search unavailable')).toBeInTheDocument();
    });

    expect(input).toBeDisabled();
  });

  it('should display matching results for a valid query', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByLabelText('Search guide');
    await user.click(input);

    await waitFor(() => {
      expect(guideApi.fetchSearchIndex).toHaveBeenCalled();
    });

    await user.type(input, 'Battle');

    await waitFor(() => {
      // Text is split by highlight <mark> element, so use a function matcher
      expect(screen.getByRole('option')).toBeInTheDocument();
      expect(screen.getByRole('option').textContent).toContain('Battle');
      expect(screen.getByRole('option').textContent).toContain('Flow');
    });
  });
});
