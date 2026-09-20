import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SearchTrigger from '../SearchTrigger';

describe('SearchTrigger', () => {
  it('renders a labelled desktop discovery control with a shortcut hint and 44px target', () => {
    render(<SearchTrigger onOpenSearch={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Open search' });

    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('⌘ K')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger.className).toContain('min-h-11');
    expect(trigger.className).toContain('min-w-11');
    expect(trigger.className).toContain('focus-visible:outline-primary');
    expect(trigger.className).toContain('focus-visible:ring-primary/50');
    expect(trigger).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
  });

  it('renders the compact mobile control with an accessible name and 44px target', () => {
    render(<SearchTrigger variant="mobile" onOpenSearch={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Open search' });

    expect(screen.queryByText('⌘ K')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('title', 'Search');
    expect(trigger.className).toContain('min-h-11');
    expect(trigger.className).toContain('min-w-11');
  });

  it('notifies the palette owner of the opening control before opening without navigation', async () => {
    const user = userEvent.setup();
    const onOpenSearch = vi.fn();
    const onOpeningControl = vi.fn();
    render(<SearchTrigger onOpenSearch={onOpenSearch} onOpeningControl={onOpeningControl} />);

    const trigger = screen.getByRole('button', { name: 'Open search' });
    await user.click(trigger);

    expect(onOpeningControl).toHaveBeenCalledOnce();
    expect(onOpeningControl).toHaveBeenCalledWith(trigger);
    expect(onOpenSearch).toHaveBeenCalledOnce();
    expect(onOpeningControl.mock.invocationCallOrder[0]).toBeLessThan(onOpenSearch.mock.invocationCallOrder[0]);
  });

  it('supports native keyboard activation for Enter and Space', async () => {
    const user = userEvent.setup();
    const onOpenSearch = vi.fn();
    render(<SearchTrigger onOpenSearch={onOpenSearch} />);

    const trigger = screen.getByRole('button', { name: 'Open search' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onOpenSearch).toHaveBeenCalledTimes(2);
  });
});
