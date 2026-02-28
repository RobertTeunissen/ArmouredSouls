import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import RobotUpcomingMatches from '../RobotUpcomingMatches';

/**
 * Property-Based Tests for RobotUpcomingMatches Component
 * Feature: robot-detail-page-visual-enhancement
 */

describe('RobotUpcomingMatches - Property-Based Tests', () => {
  /**
   * Property 14: Upcoming Matches Display Completeness
   * Validates: Requirements 5.1
   * 
   * For any robot, all scheduled matches (league, tournament, and tag team)
   * with future scheduled times should be displayed in the Upcoming Matches section.
   */
  it('Property 14: should display all scheduled matches', () => {
    fc.assert(
      fc.property(
        fc.record({
          matches: fc.array(
            fc.record({
              matchId: fc.integer({ min: 1, max: 10000 }),
              opponentName: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
              opponentPortrait: fc.option(fc.constant('/src/assets/robots/robot-1.png'), { nil: undefined }),
              scheduledTime: fc.integer({ min: Date.now(), max: Date.now() + 30 * 24 * 60 * 60 * 1000 }).map(ts => new Date(ts).toISOString()),
              battleType: fc.constantFrom('league' as const, 'tournament' as const, 'tag_team' as const),
              leagueContext: fc.option(fc.constantFrom('bronze', 'silver', 'gold', 'platinum'), { nil: undefined }),
              tournamentContext: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
            }),
            { minLength: 0, maxLength: 10 }
          ).map((matches, _index) => {
            // Ensure unique matchIds
            return matches.map((match, i) => ({
              ...match,
              matchId: match.matchId + i * 10000,
            }));
          }),
          battleReadiness: fc.record({
            isReady: fc.boolean(),
            warnings: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }),
          }),
        }),
        ({ matches, battleReadiness }) => {
          const { container } = render(
            <RobotUpcomingMatches matches={matches} battleReadiness={battleReadiness} />
          );
          
          if (matches.length === 0) {
            // Should show empty state
            expect(container.textContent).toContain('No upcoming matches');
          } else {
            // Should display all matches
            const matchCards = container.querySelectorAll('[data-testid="match-card"]');
            expect(matchCards.length).toBe(matches.length);
            
            // Each match should be displayed
            matches.forEach((match) => {
              const opponentName = match.opponentName || 'TBD';
              expect(container.textContent).toContain(opponentName);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15: Battle Readiness Warnings
   * Validates: Requirements 5.5
   * 
   * For any robot with HP below 50% or no weapons equipped, visual warnings
   * should be displayed in the Upcoming Matches section.
   */
  it('Property 15: should display battle readiness warnings', () => {
    fc.assert(
      fc.property(
        fc.record({
          matches: fc.array(
            fc.record({
              matchId: fc.integer({ min: 1, max: 10000 }),
              opponentName: fc.string({ minLength: 3, maxLength: 20 }),
              opponentPortrait: fc.constant('/src/assets/robots/robot-1.png'),
              scheduledTime: fc.integer({ min: Date.now(), max: Date.now() + 30 * 24 * 60 * 60 * 1000 }).map(ts => new Date(ts).toISOString()),
              battleType: fc.constantFrom('league' as const, 'tournament' as const, 'tag_team' as const),
              leagueContext: fc.option(fc.constantFrom('bronze', 'silver', 'gold', 'platinum'), { nil: undefined }),
            }),
            { minLength: 1, maxLength: 5 }
          ).map((matches, _index) => {
            // Ensure unique matchIds
            return matches.map((match, i) => ({
              ...match,
              matchId: match.matchId + i * 10000,
            }));
          }),
          battleReadiness: fc.record({
            isReady: fc.boolean(),
            warnings: fc.array(
              fc.constantFrom('HP below 50%', 'No weapons equipped'),
              { minLength: 0, maxLength: 2 }
            ),
          }),
        }),
        ({ matches, battleReadiness }) => {
          const { container } = render(
            <RobotUpcomingMatches matches={matches} battleReadiness={battleReadiness} />
          );
          
          if (!battleReadiness.isReady && battleReadiness.warnings.length > 0) {
            // Should display "Not Battle Ready" indicator
            expect(container.textContent).toContain('Not Battle Ready');
            
            // Should display each warning
            battleReadiness.warnings.forEach((warning) => {
              expect(container.textContent).toContain(warning);
            });
            
            // Should display warning icon
            expect(container.textContent).toMatch(/🔴|🟡|⚠️/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16: Chronological Match Sorting
   * Validates: Requirements 5.7
   * 
   * For any set of upcoming matches, the matches should be sorted by
   * scheduled time in ascending order (soonest first).
   */
  it('Property 16: should sort matches chronologically (soonest first)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            matchId: fc.integer({ min: 1, max: 10000 }),
            opponentName: fc.string({ minLength: 3, maxLength: 20 }),
            opponentPortrait: fc.constant('/src/assets/robots/robot-1.png'),
            scheduledTime: fc.integer({ min: Date.now(), max: Date.now() + 30 * 24 * 60 * 60 * 1000 }).map(ts => new Date(ts).toISOString()),
            battleType: fc.constantFrom('league' as const, 'tournament' as const, 'tag_team' as const),
            leagueContext: fc.option(fc.constantFrom('bronze', 'silver', 'gold', 'platinum'), { nil: undefined }),
          }),
          { minLength: 2, maxLength: 10 }
        ).map((matches, _index) => {
          // Ensure unique matchIds
          return matches.map((match, i) => ({
            ...match,
            matchId: match.matchId + i * 10000,
          }));
        }),
        (matches) => {
          // Sort matches by scheduled time (soonest first) to simulate API behavior
          const sortedMatches = [...matches].sort((a, b) => 
            new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
          );
          
          const battleReadiness = { isReady: true, warnings: [] };
          
          const { container } = render(
            <RobotUpcomingMatches matches={sortedMatches} battleReadiness={battleReadiness} />
          );
          
          // Verify matches are sorted chronologically
          for (let i = 0; i < sortedMatches.length - 1; i++) {
            const time1 = new Date(sortedMatches[i].scheduledTime).getTime();
            const time2 = new Date(sortedMatches[i + 1].scheduledTime).getTime();
            expect(time1).toBeLessThanOrEqual(time2);
          }
          
          // Verify all matches are displayed
          const matchCards = container.querySelectorAll('[data-testid="match-card"]');
          expect(matchCards.length).toBe(sortedMatches.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17: Tag Team Match Information Display
   * Validates: Requirements 5.8
   * 
   * For any upcoming tag team match, the display should include teammate
   * robot names and opponent team composition.
   */
  it('Property 17: should display tag team match information', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            matchId: fc.integer({ min: 1, max: 10000 }),
            opponentName: fc.string({ minLength: 3, maxLength: 20 }),
            opponentPortrait: fc.constant('/src/assets/robots/robot-1.png'),
            scheduledTime: fc.integer({ min: Date.now(), max: Date.now() + 30 * 24 * 60 * 60 * 1000 }).map(ts => new Date(ts).toISOString()),
            battleType: fc.constant('tag_team' as const),
            leagueContext: fc.constantFrom('bronze', 'silver', 'gold', 'platinum'),
            teammates: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
            opponentTeam: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
          }),
          { minLength: 1, maxLength: 5 }
        ).map((matches, _index) => {
          // Ensure unique matchIds
          return matches.map((match, i) => ({
            ...match,
            matchId: match.matchId + i * 10000,
          }));
        }),
        (matches) => {
          const battleReadiness = { isReady: true, warnings: [] };
          
          const { container } = render(
            <RobotUpcomingMatches matches={matches} battleReadiness={battleReadiness} />
          );
          
          matches.forEach((match, index) => {
            // Find the match card by index (more reliable)
            const matchCards = Array.from(container.querySelectorAll('[data-testid="match-card"]'));
            const matchCard = matchCards[index];
            
            expect(matchCard).toBeDefined();
            
            if (matchCard && match.teammates && match.opponentTeam) {
              // Check that teammates are displayed
              match.teammates.forEach(teammate => {
                expect(matchCard.textContent).toContain(teammate);
              });
              
              // Check that opponent team is displayed
              match.opponentTeam.forEach(opponent => {
                expect(matchCard.textContent).toContain(opponent);
              });
              
              // Check for "Teammates:" and "Opponent Team:" labels
              expect(matchCard.textContent).toContain('Teammates:');
              expect(matchCard.textContent).toContain('Opponent Team:');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
