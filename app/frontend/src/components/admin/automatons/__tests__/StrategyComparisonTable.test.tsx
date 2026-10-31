import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StrategyComparisonTable } from '../StrategyComparisonTable';
import { COMPARISON } from './fixtures';
import type { StrategyComparison } from '../../../../utils/automatonAdminApi';

function renderTable(comparison: StrategyComparison | null = COMPARISON, error: string | null = null): { onOpenStrategy: ReturnType<typeof vi.fn> } {
  const onOpenStrategy = vi.fn();
  render(<StrategyComparisonTable comparison={comparison} error={error} onOpenStrategy={onOpenStrategy} />);
  return { onOpenStrategy };
}

/** The main comparison table (the per-mode table has a caption, this one has none). */
const mainTable = (): HTMLElement => screen.getAllByRole('table').find((t) => !t.querySelector('caption')) as HTMLElement;
const modeTable = (label: string): HTMLElement => screen.getByRole('table', { name: `Performance in ${label}` });
const mainRow = (name: string): HTMLElement => within(mainTable()).getByRole('button', { name }).closest('tr') as HTMLElement;
const modeRow = (label: string, name: RegExp): HTMLElement => within(modeTable(label)).getByRole('rowheader', { name }).closest('tr') as HTMLElement;
const cellTexts = (row: HTMLElement): string[] => within(row).getAllByRole('cell').map((c) => c.textContent ?? '');
const headers = (table: HTMLElement): string[] => within(table).getAllByRole('columnheader').map((h) => h.textContent ?? '');

describe('StrategyComparisonTable', () => {
  it('labels the tier "Highest current tier" with the honest-tier footnote', () => {
    renderTable();
    expect(headers(mainTable())).toContain('Highest current tier');
    expect(headers(mainTable())).not.toContain('Best tier reached');
    expect(cellTexts(mainRow('Swarm'))[4]).toBe('Silver (2)');
    expect(screen.getByText(/^Highest current tier: the highest league tier any robot or team of the strategy holds right now \(not the season's peak\)/))
      .toHaveTextContent('Only modes a stable has actually played count; tournaments have no tier.');
  });

  it('has no win rate vs humans column (dropped: the per-mode block covers every opponent)', () => {
    render(<StrategyComparisonTable comparison={COMPARISON} error={null} onOpenStrategy={vi.fn()} />);
    const table = screen.getAllByRole('table')[0];
    expect(within(table).queryByRole('columnheader', { name: 'Win rate vs humans' })).toBeNull();
    expect(screen.queryByText(/Win rate vs humans/)).toBeNull();
  });


  it('opens a strategy from the main table', () => {
    const { onOpenStrategy } = renderTable();
    fireEvent.click(within(mainTable()).getByRole('button', { name: 'Swarm' }));
    expect(onOpenStrategy).toHaveBeenCalledWith('swarm');
  });

  it('shows head-to-head performance for 1v1 League by default', () => {
    renderTable();
    expect(screen.getByRole('heading', { name: 'Performance by mode' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Mode' });
    // The selected mode shows a check mark (aria-hidden, so not part of its accessible name).
    expect(within(group).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['✓1v1 League', '2v2 League', '3v3 League', 'Tag Team', 'King of the Hill', 'Grand Melee']);
    const selected = within(group).getByRole('button', { name: '1v1 League' });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(within(selected).getByText('✓')).toBeInTheDocument();
    const unselected = within(group).getByRole('button', { name: 'King of the Hill' });
    expect(unselected).toHaveAttribute('aria-pressed', 'false');
    expect(within(unselected).queryByText('✓')).not.toBeInTheDocument();

    expect(headers(modeTable('1v1 League'))).toEqual(['Strategy', 'Stables played', 'Robots played', 'W–L–D', 'Win %', 'Battles (n)']);
    expect(cellTexts(modeRow('1v1 League', /Swarm/))).toEqual(['2 / 2', '5', '40–38–2', '50%', '80Low sample']);
    expect(cellTexts(modeRow('1v1 League', /Paragon/))).toEqual(['0 / 1', '0', '0–0–0', '—', '0Low sample']);
    expect(cellTexts(modeRow('1v1 League', /Human stables/))).toEqual(['9 / 9', '24', '120–80–0', '60%', '200']);
  });

  it('marks low-sample rows with a visible pill, not on the human reference', () => {
    renderTable();
    expect(within(modeRow('1v1 League', /Swarm/)).getByText('Low sample')).toBeInTheDocument();
    expect(within(modeRow('1v1 League', /Human stables/)).queryByText('Low sample')).not.toBeInTheDocument();
    const cards = screen.getByRole('list', { name: 'Performance in 1v1 League' });
    expect(within(cards).getAllByText('Low sample')).toHaveLength(2);
  });

  it('switches to King of the Hill and shows placement metrics instead of W–L–D', () => {
    renderTable();
    const group = screen.getByRole('group', { name: 'Mode' });
    fireEvent.click(within(group).getByRole('button', { name: 'King of the Hill' }));
    expect(within(group).getByRole('button', { name: 'King of the Hill' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(within(group).getByRole('button', { name: 'King of the Hill' })).getByText('✓')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: '1v1 League' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(within(group).getByRole('button', { name: '1v1 League' })).queryByText('✓')).not.toBeInTheDocument();

    const table = modeTable('King of the Hill');
    expect(headers(table)).toEqual(['Strategy', 'Stables played', 'Robots played', 'Matches (n)', '1st places', '1st-place rate', 'Best placement']);
    expect(headers(table)).not.toContain('W–L–D');
    expect(cellTexts(modeRow('King of the Hill', /Swarm/))).toEqual(['2 / 2', '4', '30Low sample', '3', '10%', '1st']);
    expect(cellTexts(modeRow('King of the Hill', /Human stables/))).toEqual(['0 / 9', '0', '0Low sample', '0', '—', '—']);
    expect(screen.queryByRole('table', { name: 'Performance in 1v1 League' })).not.toBeInTheDocument();
  });

  it('labels team modes "Teams played"', () => {
    renderTable();
    fireEvent.click(within(screen.getByRole('group', { name: 'Mode' })).getByRole('button', { name: 'Tag Team' }));
    expect(headers(modeTable('Tag Team'))).toContain('Teams played');
  });

  it('explains mirror matches, byes, placement rates and the low-sample rule', () => {
    renderTable();
    const footnote = screen.getByText(/^Per mode: this season's standings/);
    expect(footnote).toHaveTextContent('mirror matches between stables of the same strategy, which pull the win % toward 50%');
    expect(footnote).toHaveTextContent('battles between Automatons');
    expect(footnote).toHaveTextContent('Byes count as wins.');
    expect(footnote).toHaveTextContent('their rate is first places ÷ matches');
    expect(footnote).toHaveTextContent('Low sample: fewer than 5 stables or fewer than 20 battles or matches.');
  });

  it('keeps the loading, error and empty states', () => {
    const { unmount } = render(<StrategyComparisonTable comparison={null} error={null} onOpenStrategy={vi.fn()} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    unmount();

    const errorView = render(<StrategyComparisonTable comparison={null} error="The comparison could not be loaded." onOpenStrategy={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The comparison could not be loaded.');
    errorView.unmount();

    renderTable({ ...COMPARISON, rows: [] });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Performance by mode' })).not.toBeInTheDocument();
  });
});
