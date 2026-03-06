/**
 * ProgressIndicator Accessibility Tests
 *
 * Covers ARIA progressbar attributes, step list roles, and aria-current.
 * Requirements: 25.1-25.7
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import ProgressIndicator from '../ProgressIndicator';

describe('ProgressIndicator Accessibility', () => {
  it('should have role="navigation" with aria-label', () => {
    render(<ProgressIndicator current={3} total={9} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Tutorial progress');
  });

  it('should have progressbar role with correct ARIA attributes', () => {
    render(<ProgressIndicator current={5} total={9} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '5');
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '9');
  });

  it('should have descriptive aria-valuetext', () => {
    render(<ProgressIndicator current={3} total={9} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuetext', expect.stringContaining('Step 3 of 9'));
    expect(progressbar).toHaveAttribute('aria-valuetext', expect.stringContaining('complete'));
  });

  it('should update ARIA values when step changes', () => {
    const { rerender } = render(<ProgressIndicator current={1} total={9} />);
    let progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');

    rerender(<ProgressIndicator current={7} total={9} />);
    progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '7');
  });

  it('should have aria-labelledby linking to step text', () => {
    render(<ProgressIndicator current={4} total={9} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-labelledby', 'progress-label');
    expect(document.getElementById('progress-label')).toHaveTextContent('Step 4 of 9');
  });

  it('should hide decorative percentage text from screen readers', () => {
    const { container } = render(<ProgressIndicator current={3} total={9} />);
    const percentText = container.querySelector('[aria-hidden="true"]');
    expect(percentText).toBeInTheDocument();
    expect(percentText).toHaveTextContent('33% Complete');
  });

  it('should mark step dots as aria-hidden', () => {
    const { container } = render(<ProgressIndicator current={3} total={9} />);
    const dotsContainer = container.querySelector('.absolute.top-0');
    expect(dotsContainer).toHaveAttribute('aria-hidden', 'true');
  });

  it('should have mobile step list with proper list roles', () => {
    render(<ProgressIndicator current={3} total={9} />);
    const list = screen.getByRole('list', { name: 'Tutorial steps' });
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(9);
  });

  it('should mark current step with aria-current on mobile list', () => {
    render(<ProgressIndicator current={5} total={9} />);
    const items = screen.getAllByRole('listitem');
    const currentItem = items[4]; // 0-indexed, step 5
    expect(currentItem).toHaveAttribute('aria-current', 'step');
  });

  it('should not mark non-current steps with aria-current', () => {
    render(<ProgressIndicator current={5} total={9} />);
    const items = screen.getAllByRole('listitem');
    items.forEach((item, index) => {
      if (index !== 4) {
        expect(item).not.toHaveAttribute('aria-current');
      }
    });
  });
});
