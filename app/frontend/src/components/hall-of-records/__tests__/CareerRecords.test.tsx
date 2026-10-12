/**
 * CareerRecords — Most Battles shows the all-modes count.
 *
 * A battle is a battle: KotH and Grand Melee matches count toward "Most
 * Battles". The record and win rate beside it stay on the win/loss modes.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CareerRecords } from '../CareerRecords';
import type { MostBattles, RecordsData } from '../types';
import { PLACEMENT_MODES_RECORD_NOTE } from '../../PlacementModesRecordNote';

function mostBattlesEntry(overrides: Partial<MostBattles> = {}): MostBattles {
  return {
    robotId: 1,
    robotName: 'Ironclad',
    username: 'Rust Belt Robotics',
    stableType: 'human',
    allModesBattleCount: 280,
    totalBattles: 211,
    wins: 120,
    losses: 80,
    draws: 11,
    winRate: 56.9,
    elo: 1450,
    ...overrides,
  };
}

function recordsWith(mostBattles: MostBattles[]): RecordsData {
  return {
    career: { mostBattles, highestWinRate: [], mostLifetimeDamage: [], highestElo: [], mostKills: [] },
  } as unknown as RecordsData;
}

describe('CareerRecords — Most Battles', () => {
  it('shows the all-modes battle count as the record value', () => {
    render(<CareerRecords records={recordsWith([mostBattlesEntry()])} />);

    expect(screen.getByText('280 battles')).toBeInTheDocument();
    expect(screen.queryByText('211 battles')).not.toBeInTheDocument();
  });

  it('keeps the W/L/D record and win rate on the win/loss modes', () => {
    render(<CareerRecords records={recordsWith([mostBattlesEntry()])} />);

    expect(screen.getByText('Record: 120-80-11')).toBeInTheDocument();
    expect(screen.getByText('Win Rate: 56.9%')).toBeInTheDocument();
  });

  it('says every mode counts and why the record excludes the placement modes', () => {
    render(<CareerRecords records={recordsWith([mostBattlesEntry()])} />);

    const subtitle = screen.getByText(/Counts battles in every mode, including KotH and Grand Melee\./);
    expect(subtitle).toHaveTextContent(PLACEMENT_MODES_RECORD_NOTE);
  });

  it('ranks in the order the API sends', () => {
    render(
      <CareerRecords
        records={recordsWith([
          mostBattlesEntry({ robotId: 2, robotName: 'Gridlock', allModesBattleCount: 300, totalBattles: 40 }),
          mostBattlesEntry({ robotId: 1, robotName: 'Ironclad', allModesBattleCount: 280, totalBattles: 211 }),
        ])}
      />,
    );

    const values = screen.getAllByText(/^\d+ battles$/).map((el) => el.textContent);
    expect(values).toEqual(['300 battles', '280 battles']);
  });
});
