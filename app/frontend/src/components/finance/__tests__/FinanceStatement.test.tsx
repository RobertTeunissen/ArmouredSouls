import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FinanceStatement } from '../FinanceStatement';
import { RECONCILIATION, STATEMENT } from './fixtures';

describe('FinanceStatement', () => {
  it('separates every statement family and displays player-safe references', () => {
    render(<FinanceStatement statement={STATEMENT} reconciliation={RECONCILIATION} />);
    expect(screen.getByRole('heading', { name: 'Earned Credits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Investment proceeds' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Running costs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Investment purchases' })).toBeInTheDocument();
    expect(screen.getByText('Weapon sale: Arc Welder')).toBeInTheDocument();
    expect(screen.getByText('Weapon Refinement')).toBeInTheDocument();
    expect(screen.getByText(/Reference FS-REPAIR/)).toBeInTheDocument();
  });

  it('shows repair subtype and event count once without exposing raw identities', () => {
    const { container } = render(<FinanceStatement statement={STATEMENT} reconciliation={RECONCILIATION} />);
    expect(screen.getByText('Manual repairs · 1 event')).toBeInTheDocument();
    expect(container.textContent).not.toContain('financialEventId');
    expect(container.textContent).not.toContain('auditId');
  });
});

describe('FinanceStatement accessibility and provenance', () => {
  it('renders truthful per-line provenance with unique labels across multiple statements', () => {
    const { container } = render(
      <>
        <FinanceStatement statement={STATEMENT} reconciliation={RECONCILIATION} />
        <FinanceStatement statement={STATEMENT} reconciliation={RECONCILIATION} heading="Selected cycle statement" />
      </>,
    );

    expect(screen.getAllByText('Actual · report period · current cycle provisional')).not.toHaveLength(0);
    const labelledSections = Array.from(container.querySelectorAll<HTMLElement>('section[aria-labelledby]'));
    const labelIds = labelledSections.map((section) => section.getAttribute('aria-labelledby'));
    expect(new Set(labelIds).size).toBe(labelIds.length);
    for (const labelId of labelIds) {
      expect(labelId).not.toBeNull();
      expect(container.querySelector(`[id="${labelId}"]`)).not.toBeNull();
    }
  });
});
