import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AchievementBadge from '../AchievementBadge';

describe('AchievementBadge', () => {
  it('renders with correct size class for 64px (default)', () => {
    const { container } = render(<AchievementBadge tier="easy" size={64} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('w-16');
    expect(badge.className).toContain('h-16');
  });

  it('renders with correct size class for 128px', () => {
    const { container } = render(<AchievementBadge tier="easy" size={128} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('w-32');
    expect(badge.className).toContain('h-32');
  });

  it('renders with correct size class for 48px', () => {
    const { container } = render(<AchievementBadge tier="easy" size={48} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('w-12');
    expect(badge.className).toContain('h-12');
  });

  it('applies locked CSS class when locked=true', () => {
    const { container } = render(<AchievementBadge tier="easy" locked={true} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('achievement-badge--locked');
  });

  it('applies unlocked CSS class when locked=false', () => {
    const { container } = render(<AchievementBadge tier="easy" locked={false} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('achievement-badge--unlocked');
  });

  it('renders secret placeholder when secret=true and locked=true', () => {
    const { container } = render(<AchievementBadge tier="secret" secret={true} locked={true} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // Should contain "???" text
    const textEl = container.querySelector('text');
    expect(textEl?.textContent).toBe('???');
  });

  it('renders normal badge when secret=true but locked=false', () => {
    const { container } = render(<AchievementBadge tier="secret" secret={true} locked={false} />);
    const badge = container.firstChild as HTMLElement;
    // Should NOT contain "???" — should render normally
    expect(badge.className).toContain('achievement-badge--unlocked');
  });

  it('renders hexagonal SVG polygon', () => {
    const { container } = render(<AchievementBadge tier="easy" />);
    const polygon = container.querySelector('polygon');
    expect(polygon).toBeTruthy();
    expect(polygon?.getAttribute('points')).toBe('64,4 120,34 120,94 64,124 8,94 8,34');
  });
});
