/**
 * CombatRecords — Spec #46 Requirement 4
 *
 * **Validates: Requirements 4.1, 4.2, 4.5, 4.21, 4.22, 4.23**
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CombatRecords } from '../CombatRecords';
import type { MostDamageInBattle, RecordsData } from '../types';

const formatDuration = (s: number) => `${s}s`;
const formatDate = () => '15 Mar 2026';

function damageEntry(overrides: Partial<MostDamageInBattle> = {}): MostDamageInBattle {
  return {
    battleId: 101,
    damageDealt: 1500,
    robot: { id: 1, name: 'Ironclad', username: 'Rust Belt Robotics' },
    opponent: { id: 2, name: 'Sparkplug', username: 'Volt Works' },
    durationSeconds: 90,
    date: '2026-03-15T00:00:00Z',
    ...overrides,
  };
}

function recordsWith(combat: Partial<RecordsData['combat']>): RecordsData {
  return {
    combat: { mostDamageInBattle: {}, narrowestVictory: [], ...combat },
  } as unknown as RecordsData;
}

describe('CombatRecords', () => {
  it('renders no Fastest Victory or Longest Battle section', () => {
    render(
      <CombatRecords
        records={recordsWith({ mostDamageInBattle: { league_1v1: [damageEntry()] } })}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Fastest Victory/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Longest Battle/)).not.toBeInTheDocument();
  });

  it('offers a mode switcher listing only modes that have entries', () => {
    render(
      <CombatRecords
        records={recordsWith({
          mostDamageInBattle: {
            league_1v1: [damageEntry()],
            grand_melee: [damageEntry({ battleId: 202, opponent: undefined, damageDealt: 4200 })],
            league_2v2: [],
          },
        })}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('damage-mode-league_1v1')).toBeInTheDocument();
    expect(screen.getByTestId('damage-mode-grand_melee')).toBeInTheDocument();
    expect(screen.queryByTestId('damage-mode-league_2v2')).not.toBeInTheDocument();
  });

  it('shows the first populated mode by default and switches on click', () => {
    render(
      <CombatRecords
        records={recordsWith({
          mostDamageInBattle: {
            league_1v1: [damageEntry({ damageDealt: 1500 })],
            grand_melee: [damageEntry({ battleId: 202, opponent: undefined, damageDealt: 4200 })],
          },
        })}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={vi.fn()}
      />,
    );

    expect(screen.getByText('1,500 damage')).toBeInTheDocument();
    expect(screen.queryByText('4,200 damage')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('damage-mode-grand_melee'));

    expect(screen.getByText('4,200 damage')).toBeInTheDocument();
    expect(screen.queryByText('1,500 damage')).not.toBeInTheDocument();
  });

  it('names the opponent for 1v1 modes', () => {
    render(
      <CombatRecords
        records={recordsWith({ mostDamageInBattle: { league_1v1: [damageEntry()] } })}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Ironclad vs Sparkplug')).toBeInTheDocument();
  });

  it('omits the opponent for multi-participant modes rather than showing an arbitrary one', () => {
    render(
      <CombatRecords
        records={recordsWith({
          mostDamageInBattle: { grand_melee: [damageEntry({ opponent: undefined })] },
        })}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Ironclad — Grand Melee')).toBeInTheDocument();
    expect(screen.queryByText(/vs Sparkplug/)).not.toBeInTheDocument();
  });

  it('omits the whole Most Damage section when no mode has entries', () => {
    render(
      <CombatRecords
        records={recordsWith({ mostDamageInBattle: {} })}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Most Damage in Single Battle/)).not.toBeInTheDocument();
  });

  it('tolerates a missing mostDamageInBattle key from an older cached response', () => {
    render(
      <CombatRecords
        records={{ combat: { narrowestVictory: [] } } as unknown as RecordsData}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Most Damage in Single Battle/)).not.toBeInTheDocument();
  });

  it('navigates to the battle when a card is clicked', () => {
    const onBattleClick = vi.fn();
    render(
      <CombatRecords
        records={recordsWith({ mostDamageInBattle: { league_1v1: [damageEntry({ battleId: 777 })] } })}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={onBattleClick}
      />,
    );

    fireEvent.click(screen.getByText('View Battle Details →'));
    expect(onBattleClick).toHaveBeenCalledWith(777);
  });

  it('gives mode switcher buttons a 44px minimum touch target', () => {
    render(
      <CombatRecords
        records={recordsWith({ mostDamageInBattle: { league_1v1: [damageEntry()] } })}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('damage-mode-league_1v1').className).toContain('min-h-[44px]');
  });

  it('marks the active mode with aria-selected rather than colour alone', () => {
    render(
      <CombatRecords
        records={recordsWith({
          mostDamageInBattle: { league_1v1: [damageEntry()], koth: [damageEntry({ battleId: 303, opponent: undefined })] },
        })}
        formatDuration={formatDuration}
        formatDate={formatDate}
        onBattleClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('damage-mode-league_1v1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('damage-mode-koth')).toHaveAttribute('aria-selected', 'false');
  });
});
