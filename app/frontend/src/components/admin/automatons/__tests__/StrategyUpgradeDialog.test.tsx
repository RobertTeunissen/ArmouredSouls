import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrategyUpgradeDialog } from '../StrategyUpgradeDialog';
import { LIBRARY, dryRun } from './fixtures';

const api = vi.hoisted(() => ({ dryRunUpgrade: vi.fn(), confirmUpgrade: vi.fn() }));
vi.mock('../../../../utils/automatonAdminApi', () => api);

describe('StrategyUpgradeDialog (dry-run → confirm, R6.6)', () => {
  it('shows the dry-run, then upgrades only the stables that pass', async () => {
    api.dryRunUpgrade.mockResolvedValue(dryRun());
    api.confirmUpgrade.mockResolvedValue({
      strategyKey: 'swarm', toVersion: 2, confirm: true,
      upgraded: [{ catalogueKey: 'clone-legion', stableName: 'Kamino Clone Legion', fromVersion: 1, toVersion: 2, changedFields: ['strategyVersion'] }],
      rejected: [{ catalogueKey: 'swarm-two', stableName: 'Second Swarm', fromVersion: 1, code: 'AUTOMATON_BLUEPRINTS_TOO_FEW', reason: 'too few blueprints' }],
    });
    const onUpgraded = vi.fn();
    render(<StrategyUpgradeDialog strategy={LIBRARY[0]} onClose={vi.fn()} onUpgraded={onUpgraded} />);

    const dialog = screen.getByRole('dialog', { name: 'Upgrade Swarm stables to v2' });
    expect(await within(dialog).findByLabelText('All 2 stables on v1')).toBeChecked();
    expect(api.dryRunUpgrade).toHaveBeenCalledWith('swarm', { toVersion: 2 });
    expect(api.confirmUpgrade).not.toHaveBeenCalled();
    expect(within(dialog).getByText('clamped')).toBeInTheDocument();
    expect(within(dialog).getByText('new goal')).toBeInTheDocument();
    expect(within(dialog).getByText('removed')).toBeInTheDocument();
    expect(within(dialog).getByText('Shown for Kamino Clone Legion; each stable keeps its own targets. Changes apply from the next settlement.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Second Swarm: not upgraded — Goal 6 targets 11 robots/)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 of 2 stables can be upgraded\. The others stay on v1 until fixed; you will get an alert for each\. The button upgrades the 1\./)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Upgrade 1 stables' }));
    await waitFor(() => expect(api.confirmUpgrade).toHaveBeenCalledWith('swarm', { toVersion: 2 }));
    expect(await within(dialog).findByText('Upgraded 1 stables to v2. Not upgraded: Second Swarm (too few blueprints)')).toBeInTheDocument();
    expect(onUpgraded).toHaveBeenCalled();
  });

  it('upgrades one stable when "This stable" is chosen', async () => {
    api.dryRunUpgrade.mockResolvedValue(dryRun());
    api.confirmUpgrade.mockResolvedValue({ strategyKey: 'swarm', toVersion: 2, confirm: true, upgraded: [], rejected: [] });
    render(<StrategyUpgradeDialog strategy={LIBRARY[0]} onClose={vi.fn()} onUpgraded={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText('This stable: Kamino Clone Legion'));
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade 1 stables' }));
    await waitFor(() => expect(api.confirmUpgrade).toHaveBeenCalledWith('swarm', { toVersion: 2, catalogueKeys: ['clone-legion'] }));
  });

  it('closes on Escape without confirming', async () => {
    api.dryRunUpgrade.mockResolvedValue(dryRun());
    const onClose = vi.fn();
    render(<StrategyUpgradeDialog strategy={LIBRARY[0]} onClose={onClose} onUpgraded={vi.fn()} />);
    await screen.findByLabelText('All 2 stables on v1');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(api.confirmUpgrade).not.toHaveBeenCalled();
  });
});
