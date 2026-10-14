import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ToggleChip } from '../ui';

describe('ToggleChip', () => {
  it('shows the pressed state with aria-pressed, a check mark and a white border', () => {
    render(<ToggleChip pressed onClick={() => undefined}>Active · 2</ToggleChip>);
    // The check mark is aria-hidden, so the accessible name is the label only.
    const chip = screen.getByRole('button', { name: 'Active · 2' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(within(chip).getByText('✓')).toHaveAttribute('aria-hidden', 'true');
    expect(chip).toHaveClass('border-2', 'border-white');
    expect(chip).not.toHaveClass('border-transparent');
  });

  it('shows no check mark and a transparent border when not pressed', () => {
    render(<ToggleChip pressed={false} onClick={() => undefined}>Draft · 1</ToggleChip>);
    const chip = screen.getByRole('button', { name: 'Draft · 1' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(within(chip).queryByText('✓')).not.toBeInTheDocument();
    expect(chip).toHaveClass('border-2', 'border-transparent');
    expect(chip).not.toHaveClass('border-white');
  });

  it('is a plain button that calls onClick and keeps a 44 px touch target', () => {
    const onClick = vi.fn();
    render(<ToggleChip pressed={false} onClick={onClick} className="px-3">All · 3</ToggleChip>);
    const chip = screen.getByRole('button', { name: 'All · 3' });
    expect(chip).toHaveAttribute('type', 'button');
    expect(chip).toHaveClass('min-h-11', 'px-3');
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
