/**
 * YieldThresholdSlider — Repair Bay preview (Season 2, #525).
 *
 * The Repair Bay discount is 6% per level for every stable, independent of how
 * many robots it owns. The slider used to carry its own copy of the old
 * `min(90, level × (5 + robots))` formula and told players that more robots
 * meant a bigger discount. It now reads the shared repair module.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import YieldThresholdSlider from '../YieldThresholdSlider';
import { calculateRepairQuote } from '../../../../shared/utils/repairCost';

vi.mock('../../utils/robotApi', () => ({
  updateYieldThreshold: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Attribute total 230: 23,000 credits of base repair cost at 100% damage.
const ROBOT_ATTRIBUTES = { combatPower: 100, armorPlating: 130 };

function renderSlider(repairBayLevel: number) {
  return render(
    <YieldThresholdSlider
      robotId={1}
      currentThreshold={10}
      robotAttributes={ROBOT_ATTRIBUTES}
      repairBayLevel={repairBayLevel}
      onThresholdChange={vi.fn()}
    />,
  );
}

describe('YieldThresholdSlider Repair Bay preview', () => {
  it('shows the 6%-per-level discount at Level 6 without any robot-count text', () => {
    renderSlider(6);

    const line = screen.getByText(/Repair Bay Level 6/);
    expect(line).toHaveTextContent(/^Repair Bay Level 6: 36% discount$/);
    expect(line.textContent ?? '').not.toMatch(/robot/i);
  });

  it('prices every scenario with the shared quote at the Repair Bay level', () => {
    renderSlider(6);

    // Hand-computed at 36% (23,000 base): victory 13,800 × 0.64 = 8,832;
    // yield at 10% 20,700 × 0.64 = 13,248; heavy 32,775 × 0.64 = 20,976;
    // destroyed 46,000 × 0.64 = 29,440.
    const scenarios: ReadonlyArray<{ damagePercent: number; hpPercent: number; expected: number }> = [
      { damagePercent: 60, hpPercent: 40, expected: 8832 },
      { damagePercent: 90, hpPercent: 10, expected: 13248 },
      { damagePercent: 95, hpPercent: 5, expected: 20976 },
      { damagePercent: 100, hpPercent: 0, expected: 29440 },
    ];

    for (const { damagePercent, hpPercent, expected } of scenarios) {
      const quote = calculateRepairQuote({ attributeTotal: 230, damagePercent, hpPercent }, 6);
      expect(quote).toBe(expected);
      expect(screen.getByText(`₡${quote.toLocaleString()}`)).toBeInTheDocument();
    }
  });

  it('shows no discount line without a Repair Bay', () => {
    renderSlider(0);

    expect(screen.queryByText(/Repair Bay Level/)).not.toBeInTheDocument();
    expect(screen.getByText(`₡${(46000).toLocaleString()}`)).toBeInTheDocument();
  });
});
