/**
 * WinStreakRecords — Spec #46 Requirement 7
 *
 * **Validates: Requirements 7.11, 7.12, 7.13, 7.14, 7.17, 7.18, 7.19, 7.20, 7.21, 7.22, 7.23**
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WinStreakRecords } from '../WinStreakRecords';
import type { RecordsData, WinStreakEntry } from '../types';

function entry(overrides: Partial<WinStreakEntry> = {}): WinStreakEntry {
  return {
    entityId: 1,
    entityName: 'Ironclad',
    username: 'Rust Belt Robotics',
    bestWinStreak: 12,
    currentWinStreak: 12,
    isActive: true,
    wins: 40,
    ...overrides,
  };
}

function recordsWith(winStreaks: RecordsData['winStreaks']): RecordsData {
  return { winStreaks } as unknown as RecordsData;
}

describe('WinStreakRecords', () => {
  it('renders all four league modes side by side in one grouped section', () => {
    render(
      <WinStreakRecords
        records={recordsWith({
          league_1v1: [entry({ entityId: 1, entityName: 'Ironclad' })],
          league_2v2: [entry({ entityId: 2, entityName: 'Twin Hammers', bestWinStreak: 8, currentWinStreak: 3, isActive: false })],
          league_3v3: [entry({ entityId: 3, entityName: 'Triad', bestWinStreak: 6, currentWinStreak: 6 })],
          tag_team: [entry({ entityId: 4, entityName: 'Relay', bestWinStreak: 5, currentWinStreak: 0, isActive: false })],
        })}
      />,
    );

    expect(screen.getByText(/1v1 League/)).toBeInTheDocument();
    expect(screen.getByText(/2v2 League/)).toBeInTheDocument();
    expect(screen.getByText(/3v3 League/)).toBeInTheDocument();
    expect(screen.getByText(/Tag Team/)).toBeInTheDocument();
  });

  it('renders the team name for team modes and the robot name for 1v1', () => {
    render(
      <WinStreakRecords
        records={recordsWith({
          league_1v1: [entry({ entityId: 1, entityName: 'Ironclad' })],
          league_2v2: [entry({ entityId: 2, entityName: 'Twin Hammers' })],
        })}
      />,
    );

    expect(screen.getByText(/Ironclad by Rust Belt Robotics/)).toBeInTheDocument();
    expect(screen.getByText(/Twin Hammers by Rust Belt Robotics/)).toBeInTheDocument();
  });

  it('marks a streak active when the current streak equals the best', () => {
    render(<WinStreakRecords records={recordsWith({ league_1v1: [entry({ isActive: true, currentWinStreak: 12 })] })} />);
    expect(screen.getByText(/Active — currently on 12/)).toBeInTheDocument();
  });

  it('shows the current streak without the active marker when it is below the best', () => {
    render(
      <WinStreakRecords
        records={recordsWith({ league_1v1: [entry({ isActive: false, currentWinStreak: 2, bestWinStreak: 12 })] })}
      />,
    );
    expect(screen.getByText('Current streak: 2')).toBeInTheDocument();
    expect(screen.queryByText(/Active — currently on/)).not.toBeInTheDocument();
  });

  it('omits a mode section entirely when no entity holds a non-zero streak', () => {
    render(
      <WinStreakRecords
        records={recordsWith({ league_1v1: [entry()], league_2v2: [], league_3v3: [], tag_team: [] })}
      />,
    );

    expect(screen.getByText(/1v1 League/)).toBeInTheDocument();
    expect(screen.queryByText(/2v2 League/)).not.toBeInTheDocument();
    expect(screen.queryByText(/3v3 League/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tag Team/)).not.toBeInTheDocument();
  });

  it('renders an empty-state message when no mode has any streak', () => {
    render(<WinStreakRecords records={recordsWith({})} />);
    expect(screen.getByTestId('win-streaks-empty')).toBeInTheDocument();
  });

  it('tolerates a missing winStreaks key from an older cached response', () => {
    render(<WinStreakRecords records={{} as unknown as RecordsData} />);
    expect(screen.getByTestId('win-streaks-empty')).toBeInTheDocument();
  });

  it('renders no battle-detail link, since a streak spans many battles', () => {
    render(<WinStreakRecords records={recordsWith({ league_1v1: [entry()] })} />);
    expect(screen.queryByText(/View Battle Details/)).not.toBeInTheDocument();
  });

  it('orders entries by best streak descending', () => {
    const { container } = render(
      <WinStreakRecords
        records={recordsWith({
          league_1v1: [
            entry({ entityId: 1, entityName: 'First', bestWinStreak: 15 }),
            entry({ entityId: 2, entityName: 'Second', bestWinStreak: 9 }),
          ],
        })}
      />,
    );

    const text = container.textContent ?? '';
    expect(text.indexOf('First')).toBeLessThan(text.indexOf('Second'));
  });

  it('renders without horizontal overflow classes on narrow viewports', () => {
    const { container } = render(<WinStreakRecords records={recordsWith({ league_1v1: [entry()] })} />);
    // The grid starts at a single column and only widens at md/lg, so a 320px
    // viewport gets one card per row with no horizontal scroll.
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('grid-cols-1');
    expect(container.querySelector('[class*="overflow-x"]')).toBeNull();
  });
});
