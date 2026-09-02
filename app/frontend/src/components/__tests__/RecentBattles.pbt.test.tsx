import { render, cleanup, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { MemoryRouter } from 'react-router-dom';
import RecentBattles from '../RecentBattles';
import type { BattleHistory, BattleParticipantData } from '../../utils/matchmakingApi';

/**
 * Property-Based Tests for RecentBattles Component
 * Feature: robot-detail-page-visual-enhancement
 */

describe('RecentBattles - Property-Based Tests', () => {
  /**
   * Property 11: Recent Battles Count Limit
   * Validates: Requirements 4.1
   * 
   * SKIPPED: Tests use incorrect mock data shape (battleId, opponentName, result, date)
   * but component expects BattleHistory[] (robot1Id, robot1, robot2, battleType, id).
   * Tests need complete rewrite with correct BattleHistory mock data.
   */
  it.skip('Property 11: should display at most 10 battles ordered by date descending', () => {
    fc.assert(
      fc.property(
        // Generate an array of 0 to 20 battles
        fc.array(
          fc.record({
            battleId: fc.integer({ min: 1, max: 10000 }),
            opponentName: fc.string({ minLength: 1, maxLength: 20 }),
            opponentPortrait: fc.constant('/src/assets/robots/robot-1.png'),
            result: fc.constantFrom('win' as const, 'loss' as const, 'draw' as const),
            battleType: fc.constantFrom('league' as const, 'tournament' as const, 'tag_team' as const),
            date: fc.date({ min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString()),
            damageDealt: fc.integer({ min: 0, max: 10000 }),
            damageTaken: fc.integer({ min: 0, max: 10000 }),
            eloChange: fc.integer({ min: -100, max: 100 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (battles) => {
          // Sort battles by date descending (most recent first) to simulate API behavior
          const sortedBattles = [...battles].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          
          // Take only first 10 battles
          const limitedBattles = sortedBattles.slice(0, 10);
          
          const { container } = render(<MemoryRouter><RecentBattles battles={limitedBattles} /></MemoryRouter>);
          
          // Count the number of battle rows displayed
          const battleRows = container.querySelectorAll('[data-testid="battle-row"]');
          
          // Should display at most 10 battles
          expect(battleRows.length).toBeLessThanOrEqual(10);
          
          // Should display exactly the number of battles provided (up to 10)
          expect(battleRows.length).toBe(Math.min(battles.length, 10));
          
          // If we have battles, verify they are ordered by date descending
          if (limitedBattles.length > 1) {
            for (let i = 0; i < limitedBattles.length - 1; i++) {
              const date1 = new Date(limitedBattles[i].date).getTime();
              const date2 = new Date(limitedBattles[i + 1].date).getTime();
              expect(date1).toBeGreaterThanOrEqual(date2);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: Battle Result Color Coding
   * Validates: Requirements 4.5
   * 
   * For any displayed battle, the result indicator should use green for wins,
   * red for losses, and amber for draws.
   */
  it.skip('Property 12: should color-code battle results correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            battleId: fc.integer({ min: 1, max: 10000 }),
            opponentName: fc.string({ minLength: 3, maxLength: 20 }),
            opponentPortrait: fc.constant('/src/assets/robots/robot-1.png'),
            result: fc.constantFrom('win' as const, 'loss' as const, 'draw' as const),
            battleType: fc.constantFrom('league' as const, 'tournament' as const, 'tag_team' as const),
            date: fc.date({ min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString()),
            damageDealt: fc.integer({ min: 0, max: 10000 }),
            damageTaken: fc.integer({ min: 0, max: 10000 }),
            eloChange: fc.integer({ min: -100, max: 100 }),
          }),
          { minLength: 1, maxLength: 10 }
        ).map((battles, _index) => {
          // Ensure unique battleIds by adding index
          return battles.map((battle, i) => ({
            ...battle,
            battleId: battle.battleId + i * 10000,
          }));
        }),
        (battles) => {
          const { container } = render(<MemoryRouter><RecentBattles battles={battles} /></MemoryRouter>);
          
          battles.forEach((battle) => {
            // Find all battle rows
            const battleRows = Array.from(container.querySelectorAll('[data-testid="battle-row"]'));
            
            // Find the specific battle row by battleId (more reliable than opponent name)
            const battleRow = battleRows[battles.indexOf(battle)];
            
            expect(battleRow).toBeDefined();
            
            if (battleRow) {
              // Check border color based on result
              if (battle.result === 'win') {
                expect(battleRow.classList.contains('border-success')).toBe(true);
              } else if (battle.result === 'loss') {
                expect(battleRow.classList.contains('border-error')).toBe(true);
              } else if (battle.result === 'draw') {
                expect(battleRow.classList.contains('border-warning')).toBe(true);
              }
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Tag Team Battle Information Display
   * Validates: Requirements 4.8
   * 
   * For any tag team battle, the display should include teammate names and
   * opponent team composition in addition to standard battle information.
   */
  it.skip('Property 13: should display tag team battle information', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            battleId: fc.integer({ min: 1, max: 10000 }),
            opponentName: fc.string({ minLength: 3, maxLength: 20 }),
            opponentPortrait: fc.constant('/src/assets/robots/robot-1.png'),
            result: fc.constantFrom('win' as const, 'loss' as const, 'draw' as const),
            battleType: fc.constant('tag_team' as const),
            date: fc.date({ min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString()),
            damageDealt: fc.integer({ min: 0, max: 10000 }),
            damageTaken: fc.integer({ min: 0, max: 10000 }),
            eloChange: fc.integer({ min: -100, max: 100 }),
            teammates: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
            opponentTeam: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
          }),
          { minLength: 1, maxLength: 5 }
        ).map((battles, _index) => {
          // Ensure unique battleIds
          return battles.map((battle, i) => ({
            ...battle,
            battleId: battle.battleId + i * 10000,
          }));
        }),
        (battles) => {
          const { container } = render(<MemoryRouter><RecentBattles battles={battles} /></MemoryRouter>);
          
          battles.forEach((battle, index) => {
            // Find the battle row by index (more reliable)
            const battleRows = Array.from(container.querySelectorAll('[data-testid="battle-row"]'));
            const battleRow = battleRows[index];
            
            expect(battleRow).toBeDefined();
            
            if (battleRow && battle.teammates && battle.opponentTeam) {
              // Check that teammates are displayed
              battle.teammates.forEach(teammate => {
                expect(battleRow.textContent).toContain(teammate);
              });
              
              // Check that opponent team is displayed
              battle.opponentTeam.forEach(opponent => {
                expect(battleRow.textContent).toContain(opponent);
              });
              
              // Check for "Teammates:" and "Opponent Team:" labels
              expect(battleRow.textContent).toContain('Teammates:');
              expect(battleRow.textContent).toContain('Opponent Team:');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

function makeResolvedParticipant(
  robotId: number,
  userId: number,
  team: number,
  credits: number,
  streamingRevenue: number,
): BattleParticipantData {
  return {
    robotId,
    team,
    role: null,
    eloBefore: 1200,
    eloAfter: 1210,
    finalHP: 100,
    credits,
    streamingRevenue,
    prestigeAwarded: robotId,
    fameAwarded: credits / 10,
    damageDealt: 10,
    placement: null,
    yielded: false,
    destroyed: false,
    robot: {
      id: robotId,
      name: `Robot ${robotId}`,
      userId,
      user: { username: `user-${userId}` },
    },
  };
}

function makeResolvedBattle(participants: BattleParticipantData[], overrides: Partial<BattleHistory> = {}): BattleHistory {
  return {
    id: 901,
    battleType: 'league_3v3',
    createdAt: '2026-06-01T12:00:00Z',
    winnerId: participants[0]?.robotId ?? null,
    robot1Id: participants[0]?.robotId ?? 1,
    robot2Id: participants[1]?.robotId ?? null,
    robot1: participants[0]?.robot ?? { id: 1, name: 'Robot 1', userId: 99, user: { username: 'other' } },
    robot2: participants[1]?.robot ?? null,
    robot1ELOBefore: 1200,
    robot1ELOAfter: 1210,
    robot2ELOBefore: 1200,
    robot2ELOAfter: 1190,
    robot1FinalHP: 100,
    robot2FinalHP: 0,
    winnerReward: 100,
    loserReward: 20,
    durationSeconds: 30,
    participants,
    ...overrides,
  } as BattleHistory;
}

describe('RecentBattles resolved display instances', () => {
  afterEach(() => cleanup());

  it('should show one same-side card with the side-scoped credit total', () => {
    const battle = makeResolvedBattle([
      makeResolvedParticipant(10, 7, 1, 100, 10),
      makeResolvedParticipant(11, 7, 1, 200, 20),
      makeResolvedParticipant(12, 7, 1, 300, 30),
      makeResolvedParticipant(20, 8, 2, 900, 90),
    ]);

    render(
      <MemoryRouter>
        <RecentBattles battles={[battle]} userId={7} />
      </MemoryRouter>,
    );

    const cards = screen.getAllByRole('button', { name: /battle result/i });
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('660');
    expect(cards[0].textContent).not.toContain('990');
  });

  it('should render two independent cards for opposite owned sides', () => {
    const battle = makeResolvedBattle([
      makeResolvedParticipant(10, 7, 1, 100, 10),
      makeResolvedParticipant(20, 7, 2, 300, 30),
      makeResolvedParticipant(30, 8, 1, 900, 90),
    ]);

    render(
      <MemoryRouter>
        <RecentBattles battles={[battle]} userId={7} />
      </MemoryRouter>,
    );

    const cards = screen.getAllByRole('button', { name: /battle result/i });
    expect(cards).toHaveLength(2);
    expect(cards.map(card => card.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('110'),
      expect.stringContaining('330'),
    ]));
  });

  it('should render a resolved bye without an opponent', () => {
    const battle = makeResolvedBattle([
      makeResolvedParticipant(10, 7, 1, 25, 0),
    ], {
      battleType: 'league_1v1',
      isByeMatch: true,
      robot2Id: null,
      robot2: null,
    });

    render(
      <MemoryRouter>
        <RecentBattles battles={[battle]} userId={7} />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('BYE').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No opponent — walkover/).length).toBeGreaterThan(0);
    expect(screen.queryByText('No opponent battle')).toBeNull();
  });
});
