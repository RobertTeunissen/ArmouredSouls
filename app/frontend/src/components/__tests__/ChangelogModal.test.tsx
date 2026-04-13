/**
 * Tests for ChangelogModal component.
 *
 * Requirements: 3.1, 3.4, 3.7, 3.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ChangelogModal from '../ChangelogModal';
import type { ChangelogEntry } from '../../utils/changelogApi';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockFetchUnreadEntries = vi.fn();
const mockDismissChangelog = vi.fn();

vi.mock('../../utils/changelogApi', () => ({
  fetchUnreadEntries: (...args: unknown[]) => mockFetchUnreadEntries(...args),
  dismissChangelog: (...args: unknown[]) => mockDismissChangelog(...args),
}));

function makeEntry(overrides: Partial<ChangelogEntry> = {}): ChangelogEntry {
  return {
    id: 1,
    title: 'Test Entry',
    body: 'Test body content',
    category: 'feature',
    status: 'published',
    imageUrl: null,
    publishDate: '2026-01-15T12:00:00Z',
    sourceType: null,
    sourceRef: null,
    createdBy: null,
    createdAt: '2026-01-15T12:00:00Z',
    updatedAt: '2026-01-15T12:00:00Z',
    ...overrides,
  };
}

function renderModal() {
  return render(
    <MemoryRouter>
      <ChangelogModal />
    </MemoryRouter>,
  );
}

describe('ChangelogModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDismissChangelog.mockResolvedValue(undefined);
  });

  it('should appear when unread entries > 0', async () => {
    mockFetchUnreadEntries.mockResolvedValue([makeEntry()]);
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('changelog-modal')).toBeInTheDocument();
    });
  });

  it('should not appear when unread entries = 0', async () => {
    mockFetchUnreadEntries.mockResolvedValue([]);
    renderModal();
    // Wait for the effect to run, then verify no modal
    await waitFor(() => {
      expect(mockFetchUnreadEntries).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('changelog-modal')).not.toBeInTheDocument();
  });

  it('should not appear when fetch fails', async () => {
    mockFetchUnreadEntries.mockRejectedValue(new Error('Network error'));
    renderModal();
    await waitFor(() => {
      expect(mockFetchUnreadEntries).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('changelog-modal')).not.toBeInTheDocument();
  });

  it('should close and call dismissChangelog when dismiss button is clicked', async () => {
    mockFetchUnreadEntries.mockResolvedValue([makeEntry()]);
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('changelog-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('changelog-dismiss'));

    await waitFor(() => {
      expect(screen.queryByTestId('changelog-modal')).not.toBeInTheDocument();
    });
    expect(mockDismissChangelog).toHaveBeenCalled();
  });

  it('should display max 10 entries with overflow message when count > 10', async () => {
    const entries = Array.from({ length: 12 }, (_, i) =>
      makeEntry({ id: i + 1, title: `Entry ${i + 1}` }),
    );
    mockFetchUnreadEntries.mockResolvedValue(entries);
    renderModal();

    await waitFor(() => {
      expect(screen.getByTestId('changelog-modal')).toBeInTheDocument();
    });

    const renderedEntries = screen.getAllByTestId('changelog-modal-entry');
    expect(renderedEntries).toHaveLength(10);
    expect(screen.getByTestId('changelog-overflow-message')).toHaveTextContent(
      '2 more updates available',
    );
  });

  it('should have "View all updates" link that navigates to /changelog', async () => {
    mockFetchUnreadEntries.mockResolvedValue([makeEntry()]);
    const user = userEvent.setup();
    renderModal();

    await waitFor(() => {
      expect(screen.getByTestId('changelog-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('changelog-view-all'));
    expect(mockNavigate).toHaveBeenCalledWith('/changelog');
  });
});
