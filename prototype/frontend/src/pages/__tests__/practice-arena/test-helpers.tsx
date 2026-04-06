/**
 * Shared helpers and factories for PracticeArenaPage tests
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PracticeArenaPage from '../../PracticeArenaPage';
import apiClient from '../../../utils/apiClient';
import { mockRobots, mockSparringPartners } from './test-data';

const mockedApi = vi.mocked(apiClient);

export { mockedApi };

export function makeBattleResult(overrides: Record<string, unknown> = {}) {
  return {
    combatResult: {
      winnerId: 1,
      robot1FinalHP: 60,
      robot2FinalHP: 0,
      robot1FinalShield: 10,
      robot2FinalShield: 0,
      robot1Damage: 40,
      robot2Damage: 100,
      robot1DamageDealt: 100,
      robot2DamageDealt: 40,
      durationSeconds: 45,
      isDraw: false,
      events: [],
      ...((overrides.combatResult as object) || {}),
    },
    battleLog: [],
    robot1Info: { name: 'Iron Fist', maxHP: 100, maxShield: 50 },
    robot2Info: { name: 'AverageBot Sparring Partner', maxHP: 300, maxShield: 200 },
    ...overrides,
  };
}

export function makeBatchResult(count = 5) {
  const results = Array.from({ length: count }, (_, i) =>
    makeBattleResult({
      combatResult: {
        winnerId: i % 2 === 0 ? 1 : 2,
        robot1FinalHP: i % 2 === 0 ? 60 : 0,
        robot2FinalHP: i % 2 === 0 ? 0 : 80,
        robot1FinalShield: 0,
        robot2FinalShield: 0,
        robot1Damage: 40,
        robot2Damage: 100,
        robot1DamageDealt: 100,
        robot2DamageDealt: 40,
        durationSeconds: 30 + i * 5,
        isDraw: false,
        events: [],
      },
    }),
  );
  return {
    results,
    aggregate: {
      totalBattles: count,
      robot1Wins: 3,
      robot2Wins: 2,
      draws: 0,
      avgDurationSeconds: 40,
      avgRobot1DamageDealt: 100,
      avgRobot2DamageDealt: 40,
    },
  };
}

export function setupApiMocks() {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.includes('/api/robots')) {
      return Promise.resolve({ data: mockRobots });
    }
    if (url.includes('/api/practice-arena/sparring-partners')) {
      return Promise.resolve({ data: { sparringPartners: mockSparringPartners } });
    }
    if (url.includes('/api/facilities')) {
      return Promise.resolve({ data: [] });
    }
    return Promise.reject(new Error(`Unknown URL: ${url}`));
  });
}

export function renderPage() {
  return render(
    <BrowserRouter>
      <PracticeArenaPage />
    </BrowserRouter>,
  );
}

/** Select a robot by clicking its name button in the image grid */
export async function selectRobotByName(name: string) {
  await waitFor(() => {
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  });
  const buttons = screen.getAllByRole('button');
  const robotButton = buttons.find(btn => btn.textContent?.includes(name) && btn.querySelector('[data-testid]'));
  if (robotButton) {
    fireEvent.click(robotButton);
  }
}
