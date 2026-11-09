/**
 * Keyboard and dialog behaviour added with the jsx-a11y lint gate: clickable
 * cards answer Enter/Space, dialogs are named and close on Escape, and a click
 * inside a dialog does not count as a backdrop click.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TeamBattle } from '../../utils/teamBattleApi';
import type { AchievementWithProgress } from '../../utils/achievementUtils';

vi.mock('../../utils/robotApi', () => ({
  updateLoadoutType: vi.fn().mockResolvedValue({ robot: { id: 1 } }),
  updateStance: vi.fn().mockResolvedValue({ robot: { id: 1 } }),
}));

vi.mock('../../utils/teamBattleApi', () => ({
  renameTeamBattle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/api', () => ({
  api: { put: vi.fn().mockResolvedValue({}) },
}));

import LoadoutSelector from '../LoadoutSelector';
import StanceSelector from '../StanceSelector';
import AchievementPinnerModal from '../AchievementPinnerModal';
import RenameTeamModal from '../team-battles/RenameTeamModal';
import StandardMatchCard from '../match-cards/StandardMatchCard';
import { updateLoadoutType, updateStance } from '../../utils/robotApi';
import type { ScheduledMatch } from '../../utils/matchmakingApi';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('choice cards', () => {
  it('selects a loadout with Enter and marks the current one as pressed', async () => {
    const onLoadoutChange = vi.fn();
    render(<LoadoutSelector robotId={1} currentLoadout="single" onLoadoutChange={onLoadoutChange} />);

    const current = screen.getByRole('button', { name: /Single/ });
    expect(current).toHaveAttribute('aria-pressed', 'true');

    const twoHanded = screen.getByRole('button', { name: /Two.Handed/i });
    expect(twoHanded).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(twoHanded, { key: 'Enter' });

    await waitFor(() => expect(onLoadoutChange).toHaveBeenCalledWith('two_handed'));
    expect(updateLoadoutType).toHaveBeenCalledWith(1, 'two_handed');
  });

  it('selects a stance with Space', async () => {
    const onStanceChange = vi.fn();
    render(<StanceSelector robotId={1} currentStance="balanced" onStanceChange={onStanceChange} />);

    fireEvent.keyDown(screen.getByRole('button', { name: /Defensive/ }), { key: ' ' });

    await waitFor(() => expect(onStanceChange).toHaveBeenCalledWith('defensive'));
    expect(updateStance).toHaveBeenCalledWith(1, 'defensive');
  });

  it('ignores other keys', () => {
    render(<StanceSelector robotId={1} currentStance="balanced" onStanceChange={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Defensive/ }), { key: 'a' });
    expect(updateStance).not.toHaveBeenCalled();
  });
});

function achievement(id: string, name: string): AchievementWithProgress {
  return {
    id, name, description: `${name} description`, category: 'combat', tier: 'easy',
    rewardCredits: 0, rewardPrestige: 0, badgeIconFile: 'badge.png', hidden: false,
    unlocked: true, unlockedAt: '2026-11-01T00:00:00.000Z', robotId: null, robotName: null,
    progress: null, isPinned: false,
  };
}

describe('dialogs', () => {
  it('names the pinner dialog and closes it on a backdrop click only', () => {
    const onClose = vi.fn();
    render(
      <AchievementPinnerModal
        achievements={[achievement('C1', 'First Blood')]}
        currentPinned={[]}
        onClose={onClose}
        onPinnedChange={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /Pin Achievements/ });
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the pinner dialog on Escape', () => {
    const onClose = vi.fn();
    render(
      <AchievementPinnerModal achievements={[]} currentPinned={[]} onClose={onClose} onPinnedChange={vi.fn()} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('labels the rename field and closes the rename dialog on Escape', () => {
    const onClose = vi.fn();
    const team = { id: 4, teamName: 'Iron Pair', members: [] } as unknown as TeamBattle;
    render(<RenameTeamModal team={team} onClose={onClose} onComplete={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Rename Team' })).toBeInTheDocument();
    expect(screen.getByLabelText(/New Team Name/)).toHaveValue('Iron Pair');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('match card', () => {
  it('links the opponent name to its robot page', () => {
    const match = {
      id: 9, matchType: 'league', leagueType: 'bronze', scheduledFor: '2026-11-10T20:00:00.000Z',
    } as unknown as ScheduledMatch;
    render(
      <MemoryRouter>
        <StandardMatchCard
          match={match}
          myRobot={{ id: 1, name: 'Alpha', elo: 1200, userId: 1 }}
          opponent={{ id: 2, name: 'Bravo', elo: 1210, userId: 2 }}
          getRoundName={() => ''}
        />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link', { name: 'Bravo' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', '/robots/2');
  });
});
