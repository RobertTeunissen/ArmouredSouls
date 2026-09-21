import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FinanceStatement } from '../FinanceStatement';
import { RECONCILIATION, STATEMENT } from './fixtures';

describe('FinanceStatement', () => {
  it('separates every statement family and hides event references', () => {
    const { container } = render(<FinanceStatement statement={STATEMENT} reconciliation={RECONCILIATION} />);
    expect(screen.getByRole('heading', { name: 'Earned Credits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Investment proceeds' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Running costs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Investment purchases' })).toBeInTheDocument();
    expect(screen.getByText('Weapon sale')).toBeInTheDocument();
    expect(screen.getByText('Weapon Refinement')).toBeInTheDocument();
    expect(screen.getAllByText('2 events')).toHaveLength(5);
    expect(screen.getAllByText('1 event')).toHaveLength(3);
    expect(container.textContent).not.toContain('Reference');
    expect(container.textContent).not.toContain('FS-');
  });

  it('shows repair subtype and event count without exposing raw identities', () => {
    const { container } = render(<FinanceStatement statement={STATEMENT} reconciliation={RECONCILIATION} />);
    expect(screen.getByText('Manual repairs')).toBeInTheDocument();
    expect(screen.getAllByText('2 events')).toHaveLength(5);
    expect(screen.getAllByText('1 event')).toHaveLength(3);
    expect(container.textContent).not.toContain('financialEventId');
    expect(container.textContent).not.toContain('auditId');
  });
  it('shows one summary row per category with combined amounts and counts', () => {
    const { container } = render(<FinanceStatement statement={STATEMENT} reconciliation={RECONCILIATION} />);

    expect(container.textContent).toContain('₡45,000');
    expect(container.textContent).toContain('₡5,000');
    expect(container.textContent).toContain('₡1,000');
    expect(container.textContent).toContain('₡2,500');
    expect(container.textContent).toContain('₡4,000');
    expect(container.textContent).toContain('₡3,000');
    expect(container.textContent).toContain('₡10,000');
    expect(container.textContent).not.toContain('FS-');
    expect(container.textContent).not.toContain('Reference');
  });
});

describe('FinanceStatement accessibility and sanitized category display', () => {
  it('keeps unique disclosure labels without rendering per-line provenance', () => {
    const { container } = render(
      <>
        <FinanceStatement statement={STATEMENT} reconciliation={RECONCILIATION} />
        <FinanceStatement statement={STATEMENT} reconciliation={RECONCILIATION} heading="Selected cycle statement" />
      </>,
    );

    expect(container.textContent).not.toContain('Actual · report period · current cycle provisional');
    expect(container.textContent).not.toContain('Reference');
    const labelledSections = Array.from(container.querySelectorAll<HTMLElement>('section[aria-labelledby]'));
    const labelIds = labelledSections.map((section) => section.getAttribute('aria-labelledby'));
    expect(new Set(labelIds).size).toBe(labelIds.length);
    for (const labelId of labelIds) {
      expect(labelId).not.toBeNull();
      expect(container.querySelector(`[id="${labelId}"]`)).not.toBeNull();
    }
  });
});
