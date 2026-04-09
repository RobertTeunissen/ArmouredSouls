import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuideArticleView from '../../components/guide/GuideArticleView';
import { GuideArticle } from '../../utils/guideApi';

// Mock mermaid to avoid rendering issues in tests
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>diagram</svg>' }),
  },
}));

function createArticle(overrides: Partial<GuideArticle> = {}): GuideArticle {
  return {
    slug: 'battle-flow',
    title: 'Battle Flow',
    description: 'How battles work',
    sectionSlug: 'combat',
    sectionTitle: 'Combat',
    body: '## Overview\n\nBattle flow content here.',
    lastUpdated: '2026-02-01',
    relatedArticles: [],
    previousArticle: null,
    nextArticle: null,
    headings: [{ level: 2, text: 'Overview', id: 'overview' }],
    ...overrides,
  };
}

function renderArticleView(article: GuideArticle): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <GuideArticleView article={article} />
    </MemoryRouter>
  );
}

describe('GuideArticleView', () => {
  it('should render the article title', () => {
    renderArticleView(createArticle());
    expect(screen.getByRole('heading', { level: 1, name: 'Battle Flow' })).toBeInTheDocument();
  });

  it('should render the last updated date', () => {
    renderArticleView(createArticle({ lastUpdated: '2026-02-01' }));
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  });

  it('should render the breadcrumb with section info', () => {
    renderArticleView(createArticle());
    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
    expect(screen.getByText('Combat')).toBeInTheDocument();
  });

  it('should render the article body content', () => {
    renderArticleView(createArticle({ body: '## Test Heading\n\nSome paragraph text.' }));
    expect(screen.getByText('Some paragraph text.')).toBeInTheDocument();
  });

  it('should render related articles when present', () => {
    const article = createArticle({
      relatedArticles: [
        { slug: 'stances', title: 'Stances', sectionSlug: 'combat', sectionTitle: 'Combat' },
        { slug: 'credits', title: 'Credits & Income', sectionSlug: 'economy', sectionTitle: 'Economy & Finances' },
      ],
    });

    renderArticleView(article);

    expect(screen.getByText('Related Articles')).toBeInTheDocument();
    expect(screen.getByText('Stances')).toBeInTheDocument();
    expect(screen.getByText('Credits & Income')).toBeInTheDocument();
  });

  it('should not render related articles section when empty', () => {
    renderArticleView(createArticle({ relatedArticles: [] }));
    expect(screen.queryByText('Related Articles')).not.toBeInTheDocument();
  });

  it('should render related article links with correct hrefs', () => {
    const article = createArticle({
      relatedArticles: [
        { slug: 'stances', title: 'Stances', sectionSlug: 'combat', sectionTitle: 'Combat' },
      ],
    });

    renderArticleView(article);

    const link = screen.getByRole('link', { name: /stances/i });
    expect(link).toHaveAttribute('href', '/guide/combat/stances');
  });

  it('should render previous article navigation link', () => {
    const article = createArticle({
      previousArticle: { slug: 'malfunctions', title: 'Malfunctions', sectionSlug: 'combat' },
    });

    renderArticleView(article);

    const prevLink = screen.getByRole('link', { name: /malfunctions/i });
    expect(prevLink).toHaveAttribute('href', '/guide/combat/malfunctions');
  });

  it('should render next article navigation link', () => {
    const article = createArticle({
      nextArticle: { slug: 'stances', title: 'Stances', sectionSlug: 'combat' },
    });

    renderArticleView(article);

    const nextLink = screen.getByRole('link', { name: /stances/i });
    expect(nextLink).toHaveAttribute('href', '/guide/combat/stances');
  });

  it('should render both previous and next navigation links', () => {
    const article = createArticle({
      previousArticle: { slug: 'malfunctions', title: 'Malfunctions', sectionSlug: 'combat' },
      nextArticle: { slug: 'stances', title: 'Stances', sectionSlug: 'combat' },
    });

    renderArticleView(article);

    expect(screen.getByRole('link', { name: /malfunctions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /stances/i })).toBeInTheDocument();
  });

  it('should not render previous/next links when they are null', () => {
    renderArticleView(createArticle({ previousArticle: null, nextArticle: null }));

    // The nav container exists but has empty divs as placeholders
    const links = screen.queryAllByRole('link');
    // Only breadcrumb links should exist (Guide, Combat section)
    const navLinks = links.filter(l => l.getAttribute('href')?.includes('/guide/combat/'));
    // No prev/next article links in the bottom nav
    expect(navLinks.length).toBe(0);
  });
});
