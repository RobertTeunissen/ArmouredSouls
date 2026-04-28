/**
 * Unit Tests for AdminSlideOver
 *
 * Tests open/close states, overlay click closes, Escape key closes,
 * and width variants.
 *
 * _Requirements: 26.5_
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminSlideOver } from '../AdminSlideOver';

describe('AdminSlideOver', () => {
  it('should render content when open is true', () => {
    render(
      <AdminSlideOver open={true} onClose={vi.fn()} title="Details">
        <p>Panel content</p>
      </AdminSlideOver>,
    );

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('should not render anything when open is false', () => {
    render(
      <AdminSlideOver open={false} onClose={vi.fn()} title="Details">
        <p>Panel content</p>
      </AdminSlideOver>,
    );

    expect(screen.queryByText('Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });

  it('should render the dialog with correct aria attributes', () => {
    render(
      <AdminSlideOver open={true} onClose={vi.fn()} title="Player Info">
        <p>Content</p>
      </AdminSlideOver>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Player Info');
  });

  it('should call onClose when the close button is clicked', () => {
    const onClose = vi.fn();

    render(
      <AdminSlideOver open={true} onClose={onClose} title="Details">
        <p>Content</p>
      </AdminSlideOver>,
    );

    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call onClose when the overlay is clicked', () => {
    const onClose = vi.fn();

    const { container } = render(
      <AdminSlideOver open={true} onClose={onClose} title="Details">
        <p>Content</p>
      </AdminSlideOver>,
    );

    // The overlay is the first child div with bg-black/60
    const overlay = container.querySelector('.bg-black\\/60') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call onClose when Escape key is pressed', () => {
    const onClose = vi.fn();

    render(
      <AdminSlideOver open={true} onClose={onClose} title="Details">
        <p>Content</p>
      </AdminSlideOver>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should apply default lg width variant', () => {
    render(
      <AdminSlideOver open={true} onClose={vi.fn()} title="Details">
        <p>Content</p>
      </AdminSlideOver>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-lg');
  });

  it('should apply md width variant', () => {
    render(
      <AdminSlideOver open={true} onClose={vi.fn()} title="Details" width="md">
        <p>Content</p>
      </AdminSlideOver>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-md');
  });

  it('should apply xl width variant', () => {
    render(
      <AdminSlideOver open={true} onClose={vi.fn()} title="Details" width="xl">
        <p>Content</p>
      </AdminSlideOver>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-xl');
  });

  it('should render the title in the header', () => {
    render(
      <AdminSlideOver open={true} onClose={vi.fn()} title="Battle Details">
        <p>Content</p>
      </AdminSlideOver>,
    );

    expect(screen.getByText('Battle Details')).toBeInTheDocument();
  });
});
