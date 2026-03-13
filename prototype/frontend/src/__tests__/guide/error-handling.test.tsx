import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GuidePage from '../../pages/GuidePage';
import * as guideApi from '../../utils/guideApi';

// Mock Navigation
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Nav</div>,
}));

// Mock guideApi
vi.mock('../../utils/guideApi', async () => {
  const actual = await vi.importActual<typeof guideApi>('../../utils/guideApi');
  return {
    ...actual,
    fetchGuideSections: vi.fn(),
    fetchGuideArticle: vi.fn(),
    fetchSearchIndex: vi.fn(),
  };
});

const mockSections: guideApi.GuideSection[] = [
  {
    slug: 'combat',
    title: 'Combat',
    description: 'Battle mechanics',
    order: 1,
    articles: [
      { slug: 'battle-flow', title: 'Battle Flow', description: 'How battles work', sectionSlug: 'combat', lastUpdated: '2026-01-01' },
    ],
  },
];

function renderGuidePage(initialRoute: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/guide/:sectionSlug" element={<GuidePage />} />
        <Route path="/guide/:sectionSlug/:articleSlug" element={<GuidePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GuidePage — Error Handling', () => {
  beforeEach(() => {
    vi.mocked(guideApi.fetchGuideSections).mockResolvedValue(mockSections);
  });

  it('should display "Article not found" message on 404 error', async () => {
    const error = new Error('Not found') as Error & { response?: { status: number } };
    error.response = { status: 404 };
    vi.mocked(guideApi.fetchGuideArticle).mockRejectedValue(error);

    renderGuidePage('/guide/combat/nonexistent-article');

    await waitFor(() => {
      expect(screen.getByText('Article not found')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /back to guide/i })).toBeInTheDocument();
  });

  it('should display "Something went wrong" with retry button on 500 error', async () => {
    const error = new Error('Server error') as Error & { response?: { status: number } };
    error.response = { status: 500 };
    vi.mocked(guideApi.fetchGuideArticle).mockRejectedValue(error);

    renderGuidePage('/guide/combat/battle-flow');

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should retry fetching article when "Try Again" button is clicked', async () => {
    const error = new Error('Server error') as Error & { response?: { status: number } };
    error.response = { status: 500 };
    vi.mocked(guideApi.fetchGuideArticle).mockRejectedValueOnce(error);

    // Second call succeeds
    vi.mocked(guideApi.fetchGuideArticle).mockResolvedValueOnce({
      slug: 'battle-flow',
      title: 'Battle Flow',
      description: 'How battles work',
      sectionSlug: 'combat',
      sectionTitle: 'Combat',
      body: '## Overview\n\nContent here.',
      lastUpdated: '2026-01-01',
      relatedArticles: [],
      previousArticle: null,
      nextArticle: null,
      headings: [{ level: 2, text: 'Overview', id: 'overview' }],
    });

    renderGuidePage('/guide/combat/battle-flow');

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      // Article rendered successfully — the h1 heading confirms it
      expect(screen.getByRole('heading', { level: 1, name: 'Battle Flow' })).toBeInTheDocument();
    });

    expect(guideApi.fetchGuideArticle).toHaveBeenCalledTimes(2);
  });

  it('should display offline indicator when sections fetch fails with network error', async () => {
    vi.mocked(guideApi.fetchGuideSections).mockRejectedValue(new Error('Network Error'));

    renderGuidePage('/guide');

    await waitFor(() => {
      expect(screen.getByText(/unable to load guide/i)).toBeInTheDocument();
    });
  });

  it('should display network error message when article fetch fails without response', async () => {
    vi.mocked(guideApi.fetchGuideArticle).mockRejectedValue(new Error('Network Error'));

    renderGuidePage('/guide/combat/battle-flow');

    await waitFor(() => {
      expect(screen.getByText(/unable to load content/i)).toBeInTheDocument();
    });
  });

  it('should show offline indicator badge when network error occurs after sections loaded', async () => {
    vi.mocked(guideApi.fetchGuideArticle).mockRejectedValue(new Error('Network Error'));

    renderGuidePage('/guide/combat/battle-flow');

    await waitFor(() => {
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });
  });

  it('should still show navigation with cached sections when going offline', async () => {
    // First load succeeds
    vi.mocked(guideApi.fetchGuideSections).mockResolvedValue(mockSections);
    vi.mocked(guideApi.fetchGuideArticle).mockRejectedValue(new Error('Network Error'));

    renderGuidePage('/guide/combat/battle-flow');

    await waitFor(() => {
      // Navigation should still show the cached section
      expect(screen.getByText('Combat')).toBeInTheDocument();
    });

    // Offline indicator should be visible
    await waitFor(() => {
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });
  });
});
