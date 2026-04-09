import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GuidePage from '../../pages/GuidePage';
import * as guideApi from '../../utils/guideApi';

// Mock Navigation to avoid complex auth/routing dependencies
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
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics',
    order: 1,
    articles: [
      { slug: 'core-game-loop', title: 'Core Game Loop', description: 'The loop', sectionSlug: 'getting-started', lastUpdated: '2026-01-01' },
    ],
  },
  {
    slug: 'combat',
    title: 'Combat',
    description: 'Battle mechanics',
    order: 2,
    articles: [
      { slug: 'battle-flow', title: 'Battle Flow', description: 'How battles work', sectionSlug: 'combat', lastUpdated: '2026-01-01' },
    ],
  },
  {
    slug: 'economy',
    title: 'Economy & Finances',
    description: 'Credits and income',
    order: 3,
    articles: [],
  },
];

function renderGuidePage(initialRoute = '/guide'): ReturnType<typeof render> {
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

describe('GuidePage', () => {
  beforeEach(() => {
    vi.mocked(guideApi.fetchGuideSections).mockResolvedValue(mockSections);
    vi.mocked(guideApi.fetchGuideArticle).mockResolvedValue({
      slug: 'battle-flow',
      title: 'Battle Flow',
      description: 'How battles work',
      sectionSlug: 'combat',
      sectionTitle: 'Combat',
      body: '## Overview\n\nBattle flow content here.',
      lastUpdated: '2026-01-01',
      relatedArticles: [],
      previousArticle: null,
      nextArticle: null,
      headings: [{ level: 2, text: 'Overview', id: 'overview' }],
    });
  });

  it('should render the landing page heading at /guide', async () => {
    renderGuidePage('/guide');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /game guide/i })).toBeInTheDocument();
    });
  });

  it('should display all section descriptions on the landing page', async () => {
    renderGuidePage('/guide');

    await waitFor(() => {
      expect(screen.getByText('Learn the basics')).toBeInTheDocument();
    });

    expect(screen.getByText('Battle mechanics')).toBeInTheDocument();
    expect(screen.getByText('Credits and income')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    vi.mocked(guideApi.fetchGuideSections).mockReturnValue(new Promise(() => {}));
    renderGuidePage('/guide');

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should fetch sections on mount', async () => {
    renderGuidePage('/guide');

    await waitFor(() => {
      expect(guideApi.fetchGuideSections).toHaveBeenCalledTimes(1);
    });
  });

  it('should render the guide navigation sidebar', async () => {
    renderGuidePage('/guide');

    await waitFor(() => {
      expect(screen.getByLabelText('Guide navigation')).toBeInTheDocument();
    });
  });

  it('should render search inputs on the page (mobile and desktop)', async () => {
    renderGuidePage('/guide');

    await waitFor(() => {
      // There are two search inputs: one for mobile, one for desktop
      const inputs = screen.getAllByLabelText('Search guide');
      expect(inputs.length).toBe(2);
    });
  });
});
