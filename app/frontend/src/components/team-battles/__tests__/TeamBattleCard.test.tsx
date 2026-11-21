/**
 * TeamBattleCard — locking while a battle is scheduled.
 *
 * A scheduled battle locks the line-up (replace member, disband) but a 2v2 team
 * may still swap Active and Reserve: same two robots, only the order changes.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamBattleCard from '../TeamBattleCard';
import type { TeamBattle, TeamBattleMember } from '../../../utils/teamBattleApi';

function member(id: number, slotIndex: number, name: string): TeamBattleMember {
  return {
    id,
    teamId: 1,
    robotId: id * 10,
    slotIndex,
    robot: {
      id: id * 10, name, elo: 1200, currentHP: 100, maxHP: 100, currentShield: 10, maxShield: 10,
      loadoutType: 'single', mainWeaponId: 1, offhandWeaponId: null, subscriptions: [],
    },
  };
}

function team(overrides: Partial<TeamBattle> = {}): TeamBattle {
  return {
    id: 1, stableId: 1, teamSize: 2, teamName: 'Iron Duo',
    teamLp: null, teamLeague: null, teamLeagueId: null, cyclesInLeague: 0,
    totalLeagueWins: 0, totalLeagueLosses: 0, totalLeagueDraws: 0,
    tagTeamLp: null, tagTeamLeague: null, tagTeamLeagueId: null,
    totalTagTeamWins: 0, totalTagTeamLosses: 0, totalTagTeamDraws: 0,
    createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
    members: [member(1, 0, 'Alpha'), member(2, 1, 'Bravo')],
    isLockedForBattle: false,
    ...overrides,
  };
}

function renderCard(t: TeamBattle, onSwapPositions = vi.fn()) {
  render(
    <MemoryRouter>
      <TeamBattleCard team={t} onDisband={vi.fn()} onRename={vi.fn()} onSwap={vi.fn()} onSwapPositions={onSwapPositions} />
    </MemoryRouter>,
  );
  return onSwapPositions;
}

describe('TeamBattleCard while a battle is scheduled', () => {
  it('keeps Swap Active / Reserve enabled but locks replacing members and disbanding', () => {
    const onSwapPositions = renderCard(team({ isLockedForBattle: true }));

    const swap = screen.getByRole('button', { name: /Swap Active \/ Reserve/ });
    expect(swap).toBeEnabled();
    fireEvent.click(swap);
    expect(onSwapPositions).toHaveBeenCalledTimes(1);

    for (const replace of screen.getAllByTitle('Cannot replace a member while a battle is scheduled')) {
      expect(replace).toBeDisabled();
    }
    expect(screen.getByTitle('Cannot disband while battle is scheduled')).toBeDisabled();
    expect(screen.getByText('Members locked — battle scheduled')).toBeInTheDocument();
    expect(screen.getByText('You can still swap Active and Reserve.')).toBeInTheDocument();
  });

  it('shows no lock notice when nothing is scheduled', () => {
    renderCard(team());
    expect(screen.queryByText('Members locked — battle scheduled')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Swap Active \/ Reserve/ })).toBeEnabled();
  });
});
