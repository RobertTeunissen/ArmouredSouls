import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventBadge from '../EventBadge';

describe('EventBadge', () => {
  it('should render "League" badge for league event type', () => {
    render(<EventBadge eventType="league" />);
    expect(screen.getByText('League')).toBeInTheDocument();
  });

  it('should render "Tournament" badge for tournament event type', () => {
    render(<EventBadge eventType="tournament" />);
    expect(screen.getByText('Tournament')).toBeInTheDocument();
  });

  it('should render "Tag Team" badge for tag_team event type', () => {
    render(<EventBadge eventType="tag_team" />);
    expect(screen.getByText('Tag Team')).toBeInTheDocument();
  });

  it('should render "KotH" badge for koth event type', () => {
    render(<EventBadge eventType="koth" />);
    expect(screen.getByText('KotH')).toBeInTheDocument();
  });

  it('should render the event type string as label for unknown event types', () => {
    render(<EventBadge eventType="some_future_event" />);
    expect(screen.getByText('some_future_event')).toBeInTheDocument();
  });

  it('should apply blue color classes for league badge', () => {
    const { container } = render(<EventBadge eventType="league" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-blue-500/20');
    expect(badge?.className).toContain('text-blue-300');
  });

  it('should apply purple color classes for tournament badge', () => {
    const { container } = render(<EventBadge eventType="tournament" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-purple-500/20');
    expect(badge?.className).toContain('text-purple-300');
  });

  it('should apply green color classes for tag_team badge', () => {
    const { container } = render(<EventBadge eventType="tag_team" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-green-500/20');
    expect(badge?.className).toContain('text-green-300');
  });

  it('should apply orange color classes for koth badge', () => {
    const { container } = render(<EventBadge eventType="koth" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-orange-500/20');
    expect(badge?.className).toContain('text-orange-300');
  });

  it('should render as an inline-flex span element', () => {
    const { container } = render(<EventBadge eventType="league" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('inline-flex');
    expect(badge?.className).toContain('rounded-full');
  });
});
