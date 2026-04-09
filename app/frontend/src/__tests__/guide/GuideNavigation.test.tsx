import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GuideNavigation from '../../components/guide/GuideNavigation';
import { GuideSection } from '../../utils/guideApi';

const mockSections: GuideSection[] = [
  {
    slug: 'combat',
    title: 'Combat',
    description: 'Battle mechanics',
    order: 1,
    articles: [
      { slug: 'battle-flow', title: 'Battle Flow', description: 'How battles work', sectionSlug: 'combat', lastUpdated: '2026-01-01' },
      { slug: 'stances', title: 'Stances', description: 'Stance modifiers', sectionSlug: 'combat', lastUpdated: '2026-01-01' },
    ],
  },
  {
    slug: 'economy',
    title: 'Economy & Finances',
    description: 'Credits and income',
    order: 2,
    articles: [
      { slug: 'credits', title: 'Credits & Income', description: 'Currency system', sectionSlug: 'economy', lastUpdated: '2026-01-01' },
    ],
  },
];

function renderNav(props: Partial<React.ComponentProps<typeof GuideNavigation>> = {}): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <GuideNavigation
        sections={mockSections}
        currentSectionSlug={undefined}
        currentArticleSlug={undefined}
        isOpen={false}
        onToggle={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe('GuideNavigation', () => {
  it('should render all section titles in the sidebar', () => {
    renderNav();

    expect(screen.getByText('Combat')).toBeInTheDocument();
    expect(screen.getByText('Economy & Finances')).toBeInTheDocument();
  });

  it('should highlight the current section', () => {
    renderNav({ currentSectionSlug: 'combat' });

    const combatButton = screen.getByText('Combat').closest('button');
    expect(combatButton?.className).toContain('text-primary');
  });

  it('should highlight the current article with aria-current', () => {
    renderNav({ currentSectionSlug: 'combat', currentArticleSlug: 'battle-flow' });

    const articleLink = screen.getByText('Battle Flow');
    expect(articleLink).toHaveAttribute('aria-current', 'page');
  });

  it('should expand the current section to show articles', () => {
    renderNav({ currentSectionSlug: 'combat' });

    expect(screen.getByText('Battle Flow')).toBeInTheDocument();
    expect(screen.getByText('Stances')).toBeInTheDocument();
  });

  it('should toggle section expansion when clicking the section button', async () => {
    const user = userEvent.setup();
    renderNav();

    // Both sections are collapsed initially — find the Combat section's expand button
    const combatButton = screen.getByText('Combat').closest('a')!.closest('button')!;
    await user.click(combatButton);

    expect(screen.getByText('Battle Flow')).toBeInTheDocument();
  });

  it('should render the mobile drawer when isOpen is true', () => {
    renderNav({ isOpen: true });

    // Mobile drawer has a close button
    expect(screen.getByLabelText('Close navigation')).toBeInTheDocument();
  });

  it('should call onToggle when the mobile close button is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderNav({ isOpen: true, onToggle });

    await user.click(screen.getByLabelText('Close navigation'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should render section links pointing to /guide/:sectionSlug', () => {
    renderNav({ currentSectionSlug: 'combat' });

    const combatLink = screen.getByRole('link', { name: 'Combat' });
    expect(combatLink).toHaveAttribute('href', '/guide/combat');
  });

  it('should render article links pointing to /guide/:sectionSlug/:articleSlug', () => {
    renderNav({ currentSectionSlug: 'combat' });

    const articleLink = screen.getByRole('link', { name: 'Battle Flow' });
    expect(articleLink).toHaveAttribute('href', '/guide/combat/battle-flow');
  });

  it('should have the guide navigation aria label', () => {
    renderNav();

    expect(screen.getByLabelText('Guide navigation')).toBeInTheDocument();
  });
});
