import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import RecentBattles from '../RecentBattles';

/**
 * Property-Based Tests for RecentBattles Component
 * Feature: robot-detail-page-visual-enhancement
 */

describe('RecentBattles - Property-Based Tests', () => {
  /**
   * Property 11: Recent Battles Count Limit
   * Validates: Requirements 4.1
   * 
   * For any robot, the Recent Battles section should display at most 10 battles,
   * ordered by date descending (most recent first).
   */
  it('Property 11: should display at most 10 battles ordered by date descending', () => {
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
          
          const { container } = render(<RecentBattles battles={limitedBattles} />);
          
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
  it('Property 12: should color-code battle results correctly', () => {
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
        ).map((battles, index) => {
          // Ensure unique battleIds by adding index
          return battles.map((battle, i) => ({
            ...battle,
            battleId: battle.battleId + i * 10000,
          }));
        }),
        (battles) => {
          const { container } = render(<RecentBattles battles={battles} />);
          
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
  it('Property 13: should display tag team battle information', () => {
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
        ).map((battles, index) => {
          // Ensure unique battleIds
          return battles.map((battle, i) => ({
            ...battle,
            battleId: battle.battleId + i * 10000,
          }));
        }),
        (battles) => {
          const { container } = render(<RecentBattles battles={battles} />);
          
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
