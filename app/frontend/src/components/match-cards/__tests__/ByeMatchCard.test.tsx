import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ByeMatchCard from '../ByeMatchCard';
import { resolveByeCardSubject, type ByeCardSubject } from '../bye-match-data';
import type { ScheduledMatch } from '../../../utils/matchmakingApi';

function makeMatch(matchType: ScheduledMatch['matchType'], overrides: Partial<ScheduledMatch> = {}): ScheduledMatch {
  return {
    id: `bye-${matchType}`,
    matchType,
    leagueType: 'bronze',
    scheduledFor: '2026-06-01T12:00:00Z',
    status: 'scheduled',
    ...overrides,
  };
}

const robotSubject: ByeCardSubject = {
  kind: 'robot',
  id: 10,
  name: 'IronClaw',
  userId: 7,
};

const teamSubject: ByeCardSubject = {
  kind: 'team',
  id: 101,
  name: 'Alpha Team',
  teamSize: 2,
  memberNames: ['IronClaw', 'SteelWing'],
};

const ffaSubject: ByeCardSubject = {
  kind: 'ffa',
  id: 10,
  name: 'IronClaw',
  userId: 7,
};

describe('ByeMatchCard', () => {
  it('should show a non-tournament robot bye with an expected reward and no opponent claim', () => {
    render(
      <ByeMatchCard
        match={makeMatch('league_1v1', {
          isByeMatch: true,
          byeRewardCredits: 25,
          byeRewardStatus: 'expected',
        })}
        subject={robotSubject}
      />,
    );

    expect(screen.getAllByText('BYE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1v1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('IronClaw').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No opponent — walkover').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expected bye reward: ₡25').length).toBeGreaterThan(0);
    expect(screen.queryByText('Tournament')).toBeNull();
  });

  it('should distinguish awarded and pending bye rewards without fabricating zero', () => {
    const { rerender } = render(
      <ByeMatchCard
        match={makeMatch('tournament_1v1', {
          tournamentName: 'Spring Cup',
          tournamentRound: 1,
          maxRounds: 3,
          byeRewardCredits: 40,
          byeRewardStatus: 'awarded',
        })}
        subject={robotSubject}
      />,
    );

    expect(screen.getAllByText('Awarded bye reward: ₡40').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Spring Cup/).length).toBeGreaterThan(0);

    rerender(
      <ByeMatchCard
        match={makeMatch('tournament_1v1', { byeRewardStatus: 'pending', byeRewardCredits: null })}
        subject={robotSubject}
      />,
    );
    expect(screen.getAllByText('Bye reward pending').length).toBeGreaterThan(0);
    expect(screen.queryByText(/₡0/)).toBeNull();
  });

  it('should render team and FFA subjects without switching to a mode-specific bye card', () => {
    const { rerender } = render(
      <ByeMatchCard match={makeMatch('league_2v2')} subject={teamSubject} />,
    );
    expect(screen.getAllByText(/Alpha Team/).length).toBeGreaterThan(0);

    rerender(
      <ByeMatchCard match={makeMatch('grand_melee')} subject={ffaSubject} />,
    );
    expect(screen.getAllByText('Melee').length).toBeGreaterThan(0);
    expect(screen.getAllByText('IronClaw').length).toBeGreaterThan(0);
  });
});

describe('resolveByeCardSubject', () => {
  it('should resolve a one-sided robot bye from the explicit robot perspective', () => {
    const match = makeMatch('tournament_1v1', {
      isByeMatch: true,
      robot1: {
        id: 10,
        name: 'IronClaw',
        elo: 1200,
        currentHP: 100,
        maxHP: 100,
        userId: 7,
        user: { username: 'owner' },
      },
      robot2: null,
    });

    expect(resolveByeCardSubject(match, { perspectiveRobotId: 10 })).toEqual(robotSubject);
  });

  it('should resolve a team bye from the explicit team perspective', () => {
    const match = makeMatch('tournament_2v2', {
      isByeMatch: true,
      teamBattleTeam1: {
        id: 101,
        teamName: 'Alpha Team',
        teamSize: 2,
        teamLp: 100,
        teamLeague: 'bronze',
        members: [
          { robotId: 10, robotName: 'IronClaw', robotElo: 1200, userId: 7, user: { username: 'owner' } },
          { robotId: 11, robotName: 'SteelWing', robotElo: 1200, userId: 7, user: { username: 'owner' } },
        ],
        combinedELO: 2400,
      },
      teamBattleTeam2: null,
    });

    expect(resolveByeCardSubject(match, { perspectiveTeamId: 101 })).toEqual(teamSubject);
  });

  it('should reject a negative-id placeholder and malformed bye data', () => {
    const match = makeMatch('koth', {
      isByeMatch: true,
      kothParticipants: [{ id: -1, name: 'Bye_Placeholder', elo: 0, userId: 7 }],
    });

    expect(resolveByeCardSubject(match, { perspectiveRobotId: -1 })).toBeNull();
    expect(resolveByeCardSubject(makeMatch('league_1v1', { isByeMatch: true }), { perspectiveRobotId: 10 })).toBeNull();
  });
});

describe('ByeMatchCard responsive layout', () => {
  it.each([320, 768, 1023, 1024])('should keep team subject, bye reward, and no-opponent copy usable at %spx', (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    const { container, unmount } = render(
      <ByeMatchCard
        match={makeMatch('league_2v2', {
          isByeMatch: true,
          byeRewardCredits: 50,
          byeRewardStatus: 'expected',
        })}
        subject={teamSubject}
      />,
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('BYE');
    expect(card.textContent).toContain('Alpha Team');
    expect(card.textContent).toContain('Expected bye reward: ₡50');
    expect(card.textContent).toContain('No opponent — walkover');
    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    expect(card.className).toContain('min-h-[44px]');
    expect(Array.from(card.children).some(child => child.className.includes('hidden lg:flex'))).toBe(true);
    expect(Array.from(card.children).some(child => child.className.includes('lg:hidden'))).toBe(true);

    unmount();
  });
});
