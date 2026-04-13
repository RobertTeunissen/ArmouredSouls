/**
 * Feature: in-game-changelog, Property 6: Category filter returns only matching entries
 * **Validates: Requirements 5.5**
 *
 * For any set of entries and any selected category, displayed entries all match
 * the filter. "All" shows all entries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import { MemoryRouter } from 'react-router-dom';
import ChangelogPage from '../ChangelogPage';
import type { ChangelogEntry, PaginatedChangelogResult } from '../../utils/changelogApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

// Mock Navigation to avoid complex dependency chain
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="mock-navigation">Nav</div>,
}));

const mockFetchPublishedEntries = vi.fn();

vi.mock('../../utils/changelogApi', () => ({
  fetchPublishedEntries: (...args: unknown[]) => mockFetchPublishedEntries(...args),
}));

const NUM_RUNS = 50;

const CATEGORIES = ['balance', 'feature', 'bugfix', 'economy'] as const;
type Category = typeof CATEGORIES[number];

function makeEntry(id: number, category: Category): ChangelogEntry {
  return {
    id,
    title: `Entry ${id}`,
    body: `Body for entry ${id}`,
    category,
    status: 'published',
    imageUrl: null,
    publishDate: new Date(2026, 0, id).toISOString(),
    sourceType: null,
    sourceRef: null,
    createdBy: null,
    createdAt: new Date(2026, 0, id).toISOString(),
    updatedAt: new Date(2026, 0, id).toISOString(),
  };
}

const entriesArbitrary = fc
  .array(
    fc.record({
      id: fc.integer({ min: 1, max: 1000 }),
      category: fc.constantFrom(...CATEGORIES),
    }),
    { minLength: 1, maxLength: 15 },
  )
  .map((items) =>
    // Ensure unique IDs
    items
      .filter((item, idx, arr) => arr.findIndex((a) => a.id === item.id) === idx)
      .map((item) => makeEntry(item.id, item.category)),
  )
  .filter((arr) => arr.length > 0);

const filterArbitrary = fc.constantFrom<'all' | Category>('all', ...CATEGORIES);

describe('Property 6: Category filter returns only matching entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when a category filter is selected, only entries of that category are displayed; "all" shows all', async () => {
    await fc.assert(
      fc.asyncProperty(entriesArbitrary, filterArbitrary, async (allEntries, selectedFilter) => {
        cleanup();

        // The mock returns entries filtered by category (simulating backend behavior)
        mockFetchPublishedEntries.mockImplementation(
          (_page: number, _perPage: number, category?: string) => {
            const filtered = category
              ? allEntries.filter((e) => e.category === category)
              : allEntries;
            const result: PaginatedChangelogResult = {
              entries: filtered,
              total: filtered.length,
              page: 1,
              perPage: 20,
            };
            return Promise.resolve(result);
          },
        );

        const user = userEvent.setup();

        render(
          <MemoryRouter>
            <ChangelogPage />
          </MemoryRouter>,
        );

        // Wait for initial load
        await waitFor(() => {
          expect(mockFetchPublishedEntries).toHaveBeenCalled();
        });

        // Click the filter button
        const filterButton = screen.getByRole('button', { name: new RegExp(`^${selectedFilter}$`, 'i') });
        await user.click(filterButton);

        // Wait for re-render after filter change
        await waitFor(() => {
          // The mock should have been called with the correct category
          const lastCall = mockFetchPublishedEntries.mock.calls[mockFetchPublishedEntries.mock.calls.length - 1];
          if (selectedFilter === 'all') {
            expect(lastCall[2]).toBeUndefined();
          } else {
            expect(lastCall[2]).toBe(selectedFilter);
          }
        });

        // Verify displayed entries match the filter
        const displayedEntries = screen.queryAllByTestId('changelog-entry');
        const expectedEntries =
          selectedFilter === 'all'
            ? allEntries
            : allEntries.filter((e) => e.category === selectedFilter);

        expect(displayedEntries).toHaveLength(expectedEntries.length);

        cleanup();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
