/**
 * Tests for AdminChangelogTab component.
 *
 * Requirements: 6.1, 6.3, 6.7, 6.8, 6.9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { AdminChangelogTab } from '../AdminChangelogTab';
import type { ChangelogEntry, PaginatedChangelogResult } from '../../../utils/changelogApi';

const mockFetchAllEntries = vi.fn();
const mockCreateEntry = vi.fn();
const mockUpdateEntry = vi.fn();
const mockDeleteEntry = vi.fn();
const mockPublishEntry = vi.fn();
const mockUploadChangelogImage = vi.fn();

vi.mock('../../../utils/changelogApi', () => ({
  fetchAllEntries: (...args: unknown[]) => mockFetchAllEntries(...args),
  createEntry: (...args: unknown[]) => mockCreateEntry(...args),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  deleteEntry: (...args: unknown[]) => mockDeleteEntry(...args),
  publishEntry: (...args: unknown[]) => mockPublishEntry(...args),
  uploadChangelogImage: (...args: unknown[]) => mockUploadChangelogImage(...args),
}));

function makeDraftEntry(overrides: Partial<ChangelogEntry> = {}): ChangelogEntry {
  return {
    id: 1,
    title: 'Draft Entry',
    body: 'Draft body',
    category: 'feature',
    status: 'draft',
    imageUrl: null,
    publishDate: null,
    sourceType: null,
    sourceRef: null,
    createdBy: 1,
    createdAt: '2026-01-10T12:00:00Z',
    updatedAt: '2026-01-10T12:00:00Z',
    ...overrides,
  };
}

function makePublishedEntry(overrides: Partial<ChangelogEntry> = {}): ChangelogEntry {
  return {
    id: 2,
    title: 'Published Entry',
    body: 'Published body',
    category: 'bugfix',
    status: 'published',
    imageUrl: null,
    publishDate: '2026-01-15T12:00:00Z',
    sourceType: null,
    sourceRef: null,
    createdBy: 1,
    createdAt: '2026-01-10T12:00:00Z',
    updatedAt: '2026-01-15T12:00:00Z',
    ...overrides,
  };
}

function makeResult(entries: ChangelogEntry[]): PaginatedChangelogResult {
  return { entries, total: entries.length, page: 1, perPage: 20 };
}

describe('AdminChangelogTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAllEntries.mockResolvedValue(makeResult([]));
    mockCreateEntry.mockResolvedValue(makeDraftEntry());
    mockPublishEntry.mockResolvedValue(makePublishedEntry());
    mockDeleteEntry.mockResolvedValue(undefined);
  });

  it('should render the tab with heading', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('admin-changelog-tab')).toBeInTheDocument();
    });
    expect(screen.getByText('Changelog Management')).toBeInTheDocument();
  });

  it('should display form fields for creating entries', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/body/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
  });

  it('should show draft entries with DRAFT badge and muted styling', async () => {
    const draft = makeDraftEntry();
    mockFetchAllEntries.mockResolvedValue(makeResult([draft]));
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('changelog-draft-entry')).toBeInTheDocument();
    });
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('should show published entries without DRAFT badge', async () => {
    const pub = makePublishedEntry();
    mockFetchAllEntries.mockResolvedValue(makeResult([pub]));
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('changelog-published-entry')).toBeInTheDocument();
    });
    expect(screen.queryByText('DRAFT')).not.toBeInTheDocument();
  });

  it('should visually distinguish drafts from published entries', async () => {
    const draft = makeDraftEntry();
    const pub = makePublishedEntry();
    mockFetchAllEntries.mockResolvedValue(makeResult([draft, pub]));
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('changelog-draft-entry')).toBeInTheDocument();
      expect(screen.getByTestId('changelog-published-entry')).toBeInTheDocument();
    });

    // Draft has opacity-70 class for muted styling
    const draftEl = screen.getByTestId('changelog-draft-entry');
    expect(draftEl.className).toContain('opacity-70');
  });

  it('should publish a draft entry when Publish button is clicked', async () => {
    const draft = makeDraftEntry();
    mockFetchAllEntries
      .mockResolvedValueOnce(makeResult([draft]))
      .mockResolvedValueOnce(makeResult([makePublishedEntry({ id: 1 })]));
    const user = userEvent.setup();
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('changelog-publish-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('changelog-publish-btn'));

    await waitFor(() => {
      expect(mockPublishEntry).toHaveBeenCalledWith(1);
    });
  });

  it('should delete with confirmation', async () => {
    const draft = makeDraftEntry();
    mockFetchAllEntries
      .mockResolvedValueOnce(makeResult([draft]))
      .mockResolvedValueOnce(makeResult([]));
    const user = userEvent.setup();
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('changelog-delete-btn')).toBeInTheDocument();
    });

    // Click delete — should show confirmation
    await user.click(screen.getByTestId('changelog-delete-btn'));
    expect(screen.getByTestId('changelog-confirm-delete')).toBeInTheDocument();

    // Confirm delete
    await user.click(screen.getByTestId('changelog-confirm-delete'));

    await waitFor(() => {
      expect(mockDeleteEntry).toHaveBeenCalledWith(1);
    });
  });

  it('should display sourceType and sourceRef for auto-generated entries', async () => {
    const autoEntry = makeDraftEntry({
      sourceType: 'spec',
      sourceRef: '24-in-game-changelog',
    });
    mockFetchAllEntries.mockResolvedValue(makeResult([autoEntry]));
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('changelog-source-info')).toBeInTheDocument();
    });
    expect(screen.getByTestId('changelog-source-info')).toHaveTextContent('spec');
    expect(screen.getByTestId('changelog-source-info')).toHaveTextContent('24-in-game-changelog');
  });

  it('should validate form and show errors for empty title', async () => {
    const user = userEvent.setup();
    renderTab();

    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });

    // Fill body but leave title empty
    await user.type(screen.getByLabelText(/body/i), 'Some body text');
    await user.click(screen.getByRole('button', { name: /create entry/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
    });
  });
});

function renderTab() {
  return render(<AdminChangelogTab />);
}
