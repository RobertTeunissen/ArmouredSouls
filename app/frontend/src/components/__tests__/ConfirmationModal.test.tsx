/**
 * T20 — dialog semantics of the shared ConfirmationModal (design §9.2).
 *
 * The props are unchanged, so the existing callers keep working; these cover
 * the additive behaviour: a labelled modal dialog, focus starting on the safe
 * (cancel) button, and Escape cancelling unless an action is in progress.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import ConfirmationModal from '../ConfirmationModal';

afterEach(() => {
  cleanup();
});

function renderModal(overrides: Partial<ComponentProps<typeof ConfirmationModal>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmationModal
      title="Unequip main weapon?"
      message="Are you sure?"
      confirmLabel="Unequip anyway"
      cancelLabel="Keep weapon"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmationModal dialog semantics', () => {
  it('is a modal dialog named by its title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Unequip main weapon?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus to the cancel button on mount', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Keep weapon' })).toHaveFocus();
  });

  it('cancels on Escape', () => {
    const { onCancel, onConfirm } = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ignores Escape while an action is in progress', () => {
    const { onCancel } = renderModal({ isLoading: true });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('still confirms and cancels through its buttons', () => {
    const { onCancel, onConfirm } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Unequip anyway' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep weapon' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
