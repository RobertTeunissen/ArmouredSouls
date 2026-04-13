/**
 * Feature: in-game-changelog, Property 5: Entry card renders all required fields
 * **Validates: Requirements 3.2, 5.4**
 *
 * For any entry with title, body, category, publishDate, the rendered card
 * contains all fields. When imageUrl is present, an image element is rendered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import { MemoryRouter } from 'react-router-dom';
import ChangelogModal from '../ChangelogModal';
import type { ChangelogEntry } from '../../utils/changelogApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockFetchUnreadEntries = vi.fn();
const mockDismissChangelog = vi.fn();

vi.mock('../../utils/changelogApi', () => ({
  fetchUnreadEntries: (...args: unknown[]) => mockFetchUnreadEntries(...args),
  dismissChangelog: (...args: unknown[]) => mockDismissChangelog(...args),
}));

const NUM_RUNS = 100;

const CATEGORIES = ['balance', 'feature', 'bugfix', 'economy'] as const;

const entryArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  body: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  category: fc.constantFrom(...CATEGORIES),
  publishDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01'), noInvalidDate: true }).map((d) => d.toISOString()),
  imageUrl: fc.oneof(fc.constant(null), fc.constant('/uploads/changelog/test.webp')),
});

function makeFullEntry(partial: {
  title: string;
  body: string;
  category: typeof CATEGORIES[number];
  publishDate: string;
  imageUrl: string | null;
}): ChangelogEntry {
  return {
    id: 1,
    status: 'published',
    sourceType: null,
    sourceRef: null,
    createdBy: null,
    createdAt: partial.publishDate,
    updatedAt: partial.publishDate,
    ...partial,
  };
}

describe('Property 5: Entry card renders all required fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDismissChangelog.mockResolvedValue(undefined);
  });

  it('renders title, body, category badge, publish date, and optional image for any entry', async () => {
    await fc.assert(
      fc.asyncProperty(entryArbitrary, async (entryData) => {
        cleanup();
        const entry = makeFullEntry(entryData);
        mockFetchUnreadEntries.mockResolvedValue([entry]);

        render(
          <MemoryRouter>
            <ChangelogModal />
          </MemoryRouter>,
        );

        await waitFor(() => {
          expect(screen.getByTestId('changelog-modal')).toBeInTheDocument();
        });

        // Title is rendered
        const titleEl = screen.getByTestId('changelog-entry-title');
        expect(titleEl.textContent).toContain(entry.title.trim());

        // Body is rendered
        const bodyEl = screen.getByTestId('changelog-entry-body');
        expect(bodyEl.textContent).toContain(entry.body.trim());

        // Category badge is rendered
        const badge = screen.getByTestId('changelog-category-badge');
        expect(badge).toHaveTextContent(entry.category);

        // Publish date is rendered
        expect(screen.getByTestId('changelog-publish-date')).toBeInTheDocument();

        // Image: present when imageUrl is set, absent when null
        if (entry.imageUrl) {
          expect(screen.getByTestId('changelog-entry-image')).toBeInTheDocument();
        } else {
          expect(screen.queryByTestId('changelog-entry-image')).not.toBeInTheDocument();
        }

        cleanup();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
