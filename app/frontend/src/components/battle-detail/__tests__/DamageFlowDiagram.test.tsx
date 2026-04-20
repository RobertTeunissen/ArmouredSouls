import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DamageFlowDiagram } from '../DamageFlowDiagram';
import type { DamageFlow } from '../../../utils/battleStatistics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDuelFlows(): DamageFlow[] {
  return [
    { source: 'Alpha', target: 'Beta', value: 120 },
    { source: 'Beta', target: 'Alpha', value: 80 },
  ];
}

function makeKothFlows(): DamageFlow[] {
  return [
    { source: 'R1', target: 'R2', value: 100 },
    { source: 'R1', target: 'R3', value: 50 },
    { source: 'R2', target: 'R1', value: 80 },
    { source: 'R2', target: 'R3', value: 30 },
    { source: 'R3', target: 'R1', value: 60 },
    { source: 'R3', target: 'R2', value: 40 },
  ];
}

function makeTagTeamFlows(): DamageFlow[] {
  return [
    { source: 'T1-A', target: 'T2-A', value: 50 },
    { source: 'T1-A', target: 'T2-B', value: 30 },
    { source: 'T2-A', target: 'T1-A', value: 40 },
    { source: 'T2-B', target: 'T1-B', value: 20 },
  ];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DamageFlowDiagram', () => {
  describe('hidden for 1v1 battles', () => {
    it('should not render for 1v1 (only 2 robots)', () => {
      const { container } = render(
        <DamageFlowDiagram damageFlows={makeDuelFlows()} battleType="league" />,
      );
      // Component returns null for < 3 robots
      expect(container.innerHTML).toBe('');
    });
  });

  describe('renders heatmap grid for 3+ robots', () => {
    it('should render the heading and heatmap container', () => {
      render(<DamageFlowDiagram damageFlows={makeKothFlows()} battleType="koth" />);
      expect(screen.getByText('🔀 Damage Matrix')).toBeInTheDocument();
      expect(screen.getByTestId('damage-flow-diagram')).toBeInTheDocument();
    });

    it('should display all robot names as row and column headers', () => {
      render(<DamageFlowDiagram damageFlows={makeKothFlows()} battleType="koth" />);
      // Each name appears twice: once as row header, once as column header
      expect(screen.getAllByText('R1').length).toBe(2);
      expect(screen.getAllByText('R2').length).toBe(2);
      expect(screen.getAllByText('R3').length).toBe(2);
    });

    it('should display damage values in cells', () => {
      render(<DamageFlowDiagram damageFlows={makeKothFlows()} battleType="koth" />);
      // Values appear in cells and may also appear in totals, so use getAllByText
      // R1→R3 = 50 (unique), R2→R3 = 30 (unique)
      expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('30').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('60').length).toBeGreaterThanOrEqual(1);
    });

    it('should show — for diagonal (self) cells', () => {
      render(<DamageFlowDiagram damageFlows={makeKothFlows()} battleType="koth" />);
      // 3 diagonal cells + 1 bottom-right corner cell = 4
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBe(4);
    });
  });

  describe('renders row and column totals', () => {
    it('should display Dealt column header and Received row label', () => {
      render(<DamageFlowDiagram damageFlows={makeKothFlows()} battleType="koth" />);
      expect(screen.getByText('Dealt')).toBeInTheDocument();
      expect(screen.getByText('Received')).toBeInTheDocument();
    });

    it('should display correct row totals (damage dealt per attacker)', () => {
      render(<DamageFlowDiagram damageFlows={makeKothFlows()} battleType="koth" />);
      // R1 dealt: 100 (→R2) + 50 (→R3) = 150
      // R2 dealt: 80 (→R1) + 30 (→R3) = 110
      // R3 dealt: 60 (→R1) + 40 (→R2) = 100
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('110')).toBeInTheDocument();
    });
  });

  describe('renders for tag_team with 4 robots', () => {
    it('should display all 4 robot names', () => {
      render(<DamageFlowDiagram damageFlows={makeTagTeamFlows()} battleType="tag_team" />);
      expect(screen.getByText('🔀 Damage Matrix')).toBeInTheDocument();
      // T1-A, T2-A, T2-B, T1-B — each appears as row + column header
      expect(screen.getAllByText('T1-A').length).toBe(2);
      expect(screen.getAllByText('T2-A').length).toBe(2);
    });
  });

  describe('handles empty/zero flows', () => {
    it('should not render for empty array', () => {
      const { container } = render(<DamageFlowDiagram damageFlows={[]} />);
      expect(container.innerHTML).toBe('');
    });

    it('should not render when all flows have zero value', () => {
      const zeroFlows: DamageFlow[] = [
        { source: 'A', target: 'B', value: 0 },
        { source: 'B', target: 'A', value: 0 },
      ];
      const { container } = render(<DamageFlowDiagram damageFlows={zeroFlows} />);
      expect(container.innerHTML).toBe('');
    });
  });
});
