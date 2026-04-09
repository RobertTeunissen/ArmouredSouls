import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuideLandingPage from '../GuideLandingPage';
import { GuideSection } from '../../../utils/guideApi';

function createSection(overrides: Partial<GuideSection> = {}): GuideSection {
  return {
    slug: 'combat',
    title: 'Combat',
    description: 'Battle mechanics, damage, and strategy',
    order: 1,
    articles: [],
    ...overrides,
  };
}

function renderLanding(sections: GuideSection[]): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <GuideLandingPage sections={sections} />
    </MemoryRouter>
  );
}

describe('GuideLandingPage', () => {
  it('should render the page heading', () => {
    renderLanding([]);
    expect(screen.getByRole('heading', { level: 1, name: /game guide/i })).toBeInTheDocument();
  });

  it('should display all sections as cards with title and description', () => {
    const sections: GuideSection[] = [
      createSection({ slug: 'combat', title: 'Combat', description: 'Battle mechanics', order: 1 }),
      createSection({ slug: 'economy', title: 'Economy & Finances', description: 'Credits and income', order: 2 }),
    ];

    renderLanding(sections);

    expect(screen.getByText('Combat')).toBeInTheDocument();
    expect(screen.getByText('Battle mechanics')).toBeInTheDocument();
    expect(screen.getByText('Economy & Finances')).toBeInTheDocument();
    expect(screen.getByText('Credits and income')).toBeInTheDocument();
  });

  it('should link each section card to /guide/:sectionSlug', () => {
    const sections = [createSection({ slug: 'robots', title: 'Robots', description: 'Robot info' })];
    renderLanding(sections);

    const link = screen.getByRole('link', { name: /robots/i });
    expect(link).toHaveAttribute('href', '/guide/robots');
  });

  it('should display article count for each section', () => {
    const sections = [
      createSection({
        slug: 'combat',
        title: 'Combat',
        description: 'Battle stuff',
        articles: [
          { slug: 'battle-flow', title: 'Battle Flow', description: 'How battles work', sectionSlug: 'combat', lastUpdated: '2026-01-01' },
          { slug: 'stances', title: 'Stances', description: 'Stance modifiers', sectionSlug: 'combat', lastUpdated: '2026-01-01' },
        ],
      }),
    ];

    renderLanding(sections);
    expect(screen.getByText('2 articles')).toBeInTheDocument();
  });

  it('should display singular "article" when section has one article', () => {
    const sections = [
      createSection({
        slug: 'combat',
        title: 'Combat',
        description: 'Battle stuff',
        articles: [
          { slug: 'battle-flow', title: 'Battle Flow', description: 'How battles work', sectionSlug: 'combat', lastUpdated: '2026-01-01' },
        ],
      }),
    ];

    renderLanding(sections);
    expect(screen.getByText('1 article')).toBeInTheDocument();
  });

  it('should render an empty grid when no sections are provided', () => {
    const { container } = renderLanding([]);
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid?.children.length).toBe(0);
  });
});
