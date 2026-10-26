/**
 * Battles slide-over: result and context, participants by side, payout check
 * (mismatch, formula), combat log (chips, formula, show more, removed), and one
 * test per button: Copy for analysis, Download JSON, Open player report,
 * Show formula, Formula, event chips, Show more, Retry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BattleSlideOver } from '../BattleSlideOver';
import { EVENTS_PER_PAGE } from '../BattleCombatLog';
import { ApiError } from '../../../../utils/ApiError';
import { detail, logResponse } from './battleFixtures';

const mockGetDetail = vi.fn();
const mockGetLog = vi.fn();
const mockCopy = vi.fn();
const mockExportJson = vi.fn();
const mockDownload = vi.fn();

vi.mock('../../../../utils/adminBattlesApi', () => ({
  getBattleDetail: (id: number) => mockGetDetail(id),
  getBattleLog: (id: number) => mockGetLog(id),
  copyBattleExport: (id: number) => mockCopy(id),
  getBattleExportJson: (id: number) => mockExportJson(id),
}));
vi.mock('../../../../utils/download', () => ({
  downloadJson: (name: string, value: unknown) => mockDownload(name, value),
}));

const onClose = vi.fn();

function renderPanel(battleId: number | null = 531203): void {
  render(
    <MemoryRouter initialEntries={['/admin/battles']}>
      <Routes>
        <Route path="/admin/battles" element={<BattleSlideOver battleId={battleId} onClose={onClose} />} />
        <Route path="/battle/:id" element={<p>Player report page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDetail.mockResolvedValue(detail());
  mockGetLog.mockResolvedValue(logResponse());
});

describe('BattleSlideOver content', () => {
  it('shows the result, context and participants grouped by side', async () => {
    renderPanel();
    expect(await screen.findByText('Night Shift won')).toBeInTheDocument();
    expect(screen.getByText(/Team eliminated · 1m 52s/)).toBeInTheDocument();
    expect(screen.getByText('(limit 5m 0s)')).toBeInTheDocument();
    expect(screen.getByText('League 2v2 · Gold · gold_3 · 25 Oct 2026, 08:24 UTC')).toBeInTheDocument();
    expect(screen.getByText('#88412')).toBeInTheDocument();
    expect(screen.getByText('Kept until 2 Nov')).toBeInTheDocument();
    const participants = screen.getByRole('table', { name: 'Participants of battle #531203' });
    expect(within(participants).getByText('Side 1 · Steel Pact')).toBeInTheDocument();
    expect(within(participants).getByText('Side 2 · Night Shift')).toBeInTheDocument();
    expect(within(participants).getByText('Won')).toBeInTheDocument();
    expect(within(participants).getByText('Destroyed at 1m 40.0s')).toBeInTheDocument();
    expect(within(participants).getByText('−9')).toBeInTheDocument();
    expect(within(participants).getByText('+9')).toBeInTheDocument();
  });

  it('flags a payout mismatch with the gap', async () => {
    renderPanel();
    expect(await screen.findByText('Payout differs from the ledger')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Payout check per stable' });
    expect(within(table).getByText('Mismatch')).toBeInTheDocument();
    expect(within(table).getByText('(−₡2,000)')).toBeInTheDocument();
  });

  it('says when the combat log was removed and does not request it', async () => {
    mockGetDetail.mockResolvedValue(detail({ combatLog: { available: false, removesOn: '2026-10-18T01:30:00.000Z', hasFormulas: true, movementSampled: false } }));
    renderPanel();
    expect(await screen.findByText(/Combat log removed on 18 Oct/)).toBeInTheDocument();
    expect(mockGetLog).not.toHaveBeenCalled();
  });

  it('explains a log stored with thinned movement', async () => {
    mockGetDetail.mockResolvedValue(detail({ battleType: 'koth', sides: [], combatLog: { available: true, removesOn: '2026-11-02T01:30:00.000Z', hasFormulas: true, movementSampled: true } }));
    renderPanel();
    expect(await screen.findByText('Movement, range and shield events were thinned before this log was stored.')).toBeInTheDocument();
  });

  it('shows a load error with Retry', async () => {
    const user = userEvent.setup();
    mockGetDetail.mockRejectedValueOnce(new ApiError('', 'BATTLE_NOT_FOUND', 404));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('This battle no longer exists.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Night Shift won')).toBeInTheDocument();
  });
});

describe('BattleSlideOver buttons', () => {
  it('Copy for analysis copies the export and reports its size', async () => {
    const user = userEvent.setup();
    mockCopy.mockResolvedValue(151_900);
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Copy for analysis' }));
    expect(mockCopy).toHaveBeenCalledWith(531203);
    expect(await screen.findByRole('status')).toHaveTextContent('Copied the whole battle for analysis (148 kB of text).');
  });

  it('Copy for analysis shows an error when the clipboard write fails', async () => {
    const user = userEvent.setup();
    mockCopy.mockRejectedValue(new Error('denied'));
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Copy for analysis' }));
    expect(await screen.findByText('Could not copy the battle. Try Download JSON instead.')).toBeInTheDocument();
  });

  it('Download JSON saves the full record', async () => {
    const user = userEvent.setup();
    const record = { detail: { id: 531203 }, battleLog: null };
    mockExportJson.mockResolvedValue(record);
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Download JSON' }));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('battle-531203.json', record));
    expect(await screen.findByText('Downloaded battle-531203.json.')).toBeInTheDocument();
  });

  it('Open player report goes to the player battle page', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('link', { name: /Open player report/ }));
    expect(await screen.findByText('Player report page')).toBeInTheDocument();
  });

  it('Show formula expands the battle income inputs', async () => {
    const user = userEvent.setup();
    renderPanel();
    const table = await screen.findByRole('table', { name: 'Payout check per stable' });
    const [, automatonToggle] = within(table).getAllByRole('button', { name: 'Show formula' });
    await user.click(automatonToggle);
    expect(within(table).getByText('participationFloor ₡9,000 + winComponent ₡16,000 = ₡25,000')).toBeInTheDocument();
    expect(within(table).getByText(/teamSize 2 · no modifiers · formula battle_income v1 · outcome win/)).toBeInTheDocument();
    await user.click(within(table).getByRole('button', { name: 'Hide formula' }));
    expect(within(table).queryByText(/winComponent ₡16,000/)).not.toBeInTheDocument();
  });

  it('Show formula lists the KotH placement award per robot instead of zero floor/win components', async () => {
    const user = userEvent.setup();
    const base = detail();
    mockGetDetail.mockResolvedValue(detail({
      battleType: 'koth',
      sides: [],
      payout: {
        status: 'match',
        ledgerEntries: 1,
        stables: [{
          stable: base.payout.stables[0].stable,
          battleIncome: { participants: 9844, ledger: 9844 },
          streaming: { participants: 0, ledger: null },
          status: 'match',
          inputs: {
            participationFloor: 0, winComponent: 0, teamSize: 1, modifiers: [], formula: 'battle.placement_income', formulaVersion: '1', outcome: 'win',
            placementComponents: [{
              robotId: 10, robotName: 'Ironclad', mode: 'koth', tier: 'gold', placement: 2, credits: 9844,
              tierBaseReward: 7500, modeBaseMultiplier: 1.5, placementMultiplier: 0.7,
              bonus: { label: 'zone dominance', multiplier: 1.25 }, participationFloorApplied: false,
            }],
          },
        }],
      },
    }));
    renderPanel();
    const table = await screen.findByRole('table', { name: 'Payout check per stable' });
    await user.click(within(table).getByRole('button', { name: 'Show formula' }));
    const line = within(table).getByText(/Ironclad · 2nd · tier gold:/).closest('li') as HTMLElement;
    expect(line).toHaveTextContent('Ironclad · 2nd · tier gold: ₡7,500 × 1.5 × 0.7 × 1.25 zone dominance = ₡9,844');
    expect(within(table).getByText('Total ₡9,844 · ledger ₡9,844')).toBeInTheDocument();
    expect(within(table).queryByText(/participationFloor/)).not.toBeInTheDocument();
  });

  it('times a tag-team exit on the battle clock', async () => {
    const base = detail();
    mockGetDetail.mockResolvedValue(detail({
      battleType: 'tag_team',
      participants: [
        { ...base.participants[0], role: 'reserve', survivalSeconds: 40, exitSeconds: 100 },
        { ...base.participants[1], role: 'active', destroyed: false, survivalSeconds: 60, exitSeconds: 60 },
      ],
    }));
    renderPanel();
    const participants = await screen.findByRole('table', { name: /Participants of battle/ });
    expect(within(participants).getByText('Destroyed at 1m 40.0s')).toBeInTheDocument();
    expect(within(participants).getByText('Tagged out at 1m 0.0s')).toBeInTheDocument();
  });

  it('Formula opens the stored calculation of a hit', async () => {
    const user = userEvent.setup();
    renderPanel();
    const events = await screen.findByRole('list', { name: 'Combat events' });
    expect(within(events).getByText('Ironclad hits for 142 damage with Plasma Rifle (98 shield, 44 HP)')).toBeInTheDocument();
    await user.click(within(events).getByRole('button', { name: 'Formula' }));
    expect(within(events).getByText('Hit: 70 base = 80% (rolled 41.0, result: HIT)')).toBeInTheDocument();
    expect(within(events).getByText('Result: 142.00')).toBeInTheDocument();
  });

  it('event chips and the robot filter narrow the log', async () => {
    const user = userEvent.setup();
    renderPanel();
    const events = await screen.findByRole('list', { name: 'Combat events' });
    expect(within(events).getAllByRole('listitem')).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Movement' }));
    expect(within(screen.getByRole('list', { name: 'Combat events' })).getAllByRole('listitem')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Misses' }));
    expect(screen.getByText('Quasar misses Ironclad with Railgun')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Destroyed' }));
    expect(screen.getByText('Ironclad has been destroyed!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All events' }));
    // Quasar is the defender of the hit and the attacker of the miss.
    await user.type(screen.getByLabelText('Filter by robot'), 'quasar');
    expect(within(screen.getByRole('list', { name: 'Combat events' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('Show more renders the next page of events', async () => {
    const user = userEvent.setup();
    mockGetLog.mockResolvedValue(logResponse(EVENTS_PER_PAGE));
    renderPanel();
    const events = await screen.findByRole('list', { name: 'Combat events' });
    expect(within(events).getAllByRole('listitem')).toHaveLength(EVENTS_PER_PAGE);
    await user.click(screen.getByRole('button', { name: 'Show 4 more (4 left)' }));
    expect(within(screen.getByRole('list', { name: 'Combat events' })).getAllByRole('listitem')).toHaveLength(EVENTS_PER_PAGE + 4);
    expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument();
  });

  it('Close calls onClose', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
