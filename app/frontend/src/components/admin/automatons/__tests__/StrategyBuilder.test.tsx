import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrategyBuilder } from '../StrategyBuilder';
import { addGoal, buildOrderIssues, issuesAt, moveGoal, parseTarget, removeGoal, type BuilderRow } from '../builderState';
import { PROFILES, draftView, turnPreview } from './fixtures';

const api = vi.hoisted(() => ({
  getStrategyDraft: vi.fn(),
  updateStrategyDraft: vi.fn(),
  exportStrategyDraft: vi.fn(),
  deleteStrategyDraft: vi.fn(),
  previewStrategyDraft: vi.fn(),
  downloadJson: vi.fn(),
}));
vi.mock('../../../../utils/automatonAdminApi', () => api);

function renderBuilder() {
  const onBack = vi.fn();
  render(<StrategyBuilder draftId={5} profiles={PROFILES} onBack={onBack} onChanged={vi.fn()} />);
  return { onBack };
}

describe('builderState', () => {
  const rows: BuilderRow[] = draftView().definition.buildOrder.map((entry, i) => ({ id: i + 1, entry }));

  it('moves, removes and adds Goals keeping positions 1…n and row ids', () => {
    const moved = moveGoal(rows, 0, 1);
    expect(moved.map((r) => [r.id, r.entry.position])).toEqual([[2, 1], [1, 2], [3, 3]]);
    expect(removeGoal(rows, 1).map((r) => r.entry.position)).toEqual([1, 2]);
    const added = addGoal(rows, { type: 'refine' }, 9);
    expect(added[3]).toMatchObject({ id: 9, entry: { position: 4, goal: { type: 'refine' }, defaultTarget: 10, bounds: { min: 0, max: 10 } } });
  });

  it('splits Goal-level and Build_Order-level issues', () => {
    const issues = draftView().issues;
    expect(issuesAt(issues, 2)).toEqual(['Booking Office cannot go above L6.']);
    expect(buildOrderIssues(issues)).toEqual(['Every strategy needs a Tuning Bay goal with a default above 0.']);
  });

  it('parses targets, accepting Max only on attributes Goals', () => {
    expect(parseTarget('6', false)).toBe(6);
    expect(parseTarget('max', true)).toBe('max');
    expect(parseTarget('max', false)).toBeNull();
    expect(parseTarget('1.5', false)).toBeNull();
  });
});

describe('StrategyBuilder (task 10.4)', () => {
  beforeEach(() => {
    api.getStrategyDraft.mockResolvedValue(draftView());
    api.updateStrategyDraft.mockImplementation(async (_id: number, input: { buildOrder: unknown }) => draftView({
      definition: { ...draftView().definition, buildOrder: input.buildOrder as never },
      issues: [], errorCount: 0, ready: true,
    }));
    api.exportStrategyDraft.mockResolvedValue({ fileName: 'swarm.v3.json', definition: draftView().definition, upgradeWarning: [] });
    api.previewStrategyDraft.mockResolvedValue({
      draftId: 5, catalogueKey: 'clone-legion', profile: turnPreview(),
      freshStable: { startBalance: 3_000_000, endBalance: 1_000, purchases: [{ turnIndex: 0, goalId: 'g', kind: 'facility_upgrade', label: 'Roster Expansion L1', cost: 150_000 }] },
    });
  });

  it('shows rule errors next to the Goal and the missing-Goal-type error above the list', async () => {
    renderBuilder();
    const list = await screen.findByRole('list', { name: 'Build order' });
    const goal2 = within(list).getAllByRole('listitem')[1];
    expect(within(goal2).getByRole('alert')).toHaveTextContent('Booking Office cannot go above L6.');
    const listError = screen.getByText('Every strategy needs a Tuning Bay goal with a default above 0.');
    expect(listError.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('disables Export while any rule fails, with the approved help text', async () => {
    renderBuilder();
    const exportButton = await screen.findByRole('button', { name: 'Export strategy file' });
    expect(exportButton).toBeDisabled();
    expect(screen.getByText('Export is disabled while the draft has errors (2).')).toBeInTheDocument();
    expect(exportButton).toHaveAttribute('aria-describedby', 'export-help-5');
  });

  it('describes Export only when it is disabled: no reason for a saved ready draft, "save first" for unsaved edits', async () => {
    api.getStrategyDraft.mockResolvedValue(draftView({ issues: [], errorCount: 0, ready: true }));
    renderBuilder();
    const exportButton = await screen.findByRole('button', { name: 'Export strategy file' });
    expect(exportButton).toBeEnabled();
    expect(exportButton).not.toHaveAttribute('aria-describedby');
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Swarm II' } });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute('aria-describedby', 'export-help-5');
    expect(document.getElementById('export-help-5')).toHaveTextContent('Save the draft before exporting.');
  });

  it('adds, moves and removes Goals; Save draft sends the Build_Order; Export saves only the definition', async () => {
    renderBuilder();
    await screen.findByRole('list', { name: 'Build order' });
    fireEvent.change(screen.getByLabelText('Add goal', { selector: 'select' }), { target: { value: 'facility:tuning_bay' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add goal' }));
    expect(screen.getByRole('button', { name: 'Move up: 4 Tuning Bay' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Move up: 4 Tuning Bay' }));
    expect(screen.getByRole('button', { name: 'Remove: 3 Tuning Bay' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove: 1 Robots' }));
    expect(screen.queryByRole('button', { name: /Robots$/ })).not.toBeInTheDocument();
    // Unsaved changes keep Export disabled.
    expect(screen.getByRole('button', { name: 'Export strategy file' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.updateStrategyDraft).toHaveBeenCalled());
    const sent = api.updateStrategyDraft.mock.calls[0][1] as { buildOrder: { position: number; goal: { type: string; facilityType?: string } }[]; key?: string };
    expect(sent.key).toBeUndefined();
    expect(sent.buildOrder.map((e) => [e.position, e.goal.facilityType ?? e.goal.type])).toEqual([[1, 'booking_office'], [2, 'tuning_bay'], [3, 'attributes']]);

    const exportButton = await screen.findByRole('button', { name: 'Export strategy file' });
    await waitFor(() => expect(exportButton).toBeEnabled());
    fireEvent.click(exportButton);
    await waitFor(() => expect(api.downloadJson).toHaveBeenCalledWith('swarm.v3.json', draftView().definition));
    expect(await screen.findByText(/Exported swarm\.v3\.json\./)).toBeInTheDocument();
  });

  it('confirms before deleting a draft', async () => {
    api.deleteStrategyDraft.mockResolvedValue(undefined);
    const { onBack } = renderBuilder();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete draft' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete draft' });
    expect(dialog).toHaveTextContent('Delete draft "Swarm"? This cannot be undone.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete draft' }));
    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect(api.deleteStrategyDraft).toHaveBeenCalledWith(5);
  });

  it('renders the draft preview on a chosen stable and a fresh stable', async () => {
    api.getStrategyDraft.mockResolvedValue(draftView({ issues: [], errorCount: 0, ready: true }));
    renderBuilder();
    fireEvent.click(await screen.findByRole('button', { name: 'Preview draft' }));
    expect(await screen.findByText('New stable with ₡3,000,000 would buy first:')).toBeInTheDocument();
    expect(screen.getByText('Roster Expansion L1 · ₡150,000')).toBeInTheDocument();
    expect(screen.getByText('This is a preview. Nothing has been bought and no stable uses this draft.')).toBeInTheDocument();
    expect(api.previewStrategyDraft).toHaveBeenCalledWith(5, 'clone-legion');
  });
});
