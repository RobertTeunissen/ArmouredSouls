/**
 * Workshop status bar (#504): no navigation while a save is in flight. The
 * plan clears before the tuning write finishes, so `hasChanges` can already
 * be false while `saving` is still true.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StatusBar } from '../StatusBar';

function renderBar(overrides: Partial<Parameters<typeof StatusBar>[0]> = {}) {
  const props = {
    credits: 100_000, upgradeCost: 0, tuningUsed: 0, tuningPool: 10, tuningChanged: false,
    hasChanges: false, saving: false, hasNext: true,
    onDiscard: vi.fn(), onSave: vi.fn(), onNext: vi.fn(),
    ...overrides,
  };
  render(<StatusBar {...props} />);
  return props;
}

describe('StatusBar', () => {
  it('keeps the disabled Saving… button while saving, even once the plan has cleared', () => {
    const props = renderBar({ hasChanges: false, saving: true });
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Next robot ▶' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('offers Next robot when nothing is planned and nothing is saving', () => {
    const props = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Next robot ▶' }));
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });
});
