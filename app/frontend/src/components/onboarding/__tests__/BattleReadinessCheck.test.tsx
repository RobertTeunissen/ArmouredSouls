/**
 * Tests for BattleReadinessCheck component
 *
 * Requirements: 23.4, 23.5, 23.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BattleReadinessCheck from '../BattleReadinessCheck';
import type { Robot } from '../../../utils/robotApi';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/** Helper to create a minimal Robot for testing */
function makeRobot(overrides: Partial<Robot> = {}): Robot {
  return {
    id: 1,
    name: 'TestBot',
    elo: 1500,
    fame: 0,
    currentHP: 100,
    maxHP: 100,
    currentShield: 50,
    maxShield: 50,
    repairCost: 0,
    level: 1,
    currentLeague: 'Bronze',
    leagueId: null,
    leaguePoints: 0,
    userId: 1,
    createdAt: '2026-01-01T00:00:00Z',
    wins: 0,
    losses: 0,
    draws: 0,
    totalBattles: 0,
    battleReadiness: 100,
    yieldThreshold: 0,
    loadoutType: 'single',
    mainWeaponId: null,
    offhandWeaponId: null,
    combatPower: 1,
    targetingSystems: 1,
    criticalSystems: 1,
    penetration: 1,
    weaponControl: 1,
    attackSpeed: 1,
    armorPlating: 1,
    shieldCapacity: 1,
    evasionThrusters: 1,
    damageDampeners: 1,
    counterProtocols: 1,
    hullIntegrity: 1,
    servoMotors: 1,
    gyroStabilizers: 1,
    hydraulicSystems: 1,
    powerCore: 1,
    combatAlgorithms: 1,
    threatAnalysis: 1,
    adaptiveAI: 1,
    logicCores: 1,
    syncProtocols: 1,
    mainWeapon: null,
    offhandWeapon: null,
    ...overrides,
  };
}

describe('BattleReadinessCheck', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (robots: Robot[] = [], credits: number = 200_000) => {
    return render(
      <MemoryRouter>
        <BattleReadinessCheck
          robots={robots}
          credits={credits}
          onComplete={mockOnComplete}
        />
      </MemoryRouter>,
    );
  };

  // ─── Ready State ───────────────────────────────────────────────────

  describe('Ready State', () => {
    it('should show "Battle Ready!" when all conditions met', () => {
      const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
      renderComponent(robots, 200_000);

      expect(screen.getByText('Battle Ready!')).toBeInTheDocument();
    });

    it('should show green checkmark when ready', () => {
      const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
      renderComponent(robots, 200_000);

      expect(screen.getByRole('img', { name: /Green checkmark/ })).toBeInTheDocument();
    });

    it('should enable "Complete Tutorial" button when ready', () => {
      const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
      renderComponent(robots, 200_000);

      const button = screen.getByRole('button', { name: /Complete Tutorial/ });
      expect(button).toBeEnabled();
    });

    it('should call onComplete when "Complete Tutorial" is clicked', async () => {
      const user = userEvent.setup();
      const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
      renderComponent(robots, 200_000);

      await user.click(screen.getByRole('button', { name: /Complete Tutorial/ }));
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Not Ready State ───────────────────────────────────────────────

  describe('Not Ready State', () => {
    it('should show issues list when not ready', () => {
      renderComponent([], 200_000);

      expect(screen.getByText('Not Battle Ready')).toBeInTheDocument();
      const list = screen.getByRole('list', { name: /Readiness issues/ });
      expect(list).toBeInTheDocument();
    });

    it('should disable "Complete Tutorial" button when not ready', () => {
      renderComponent([], 200_000);

      const button = screen.getByRole('button', { name: /Complete Tutorial/ });
      expect(button).toBeDisabled();
    });

    it('should show "Create at least one robot" when no robots', () => {
      renderComponent([], 200_000);

      expect(screen.getByText('Create at least one robot')).toBeInTheDocument();
    });

    it('should show weapon issue when robot has no weapon', () => {
      const robots = [makeRobot({ mainWeapon: null })];
      renderComponent(robots, 200_000);

      expect(screen.getByText('Equip a weapon on at least one robot')).toBeInTheDocument();
    });

    it('should show credit issue when credits < 100K', () => {
      const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
      renderComponent(robots, 50_000);

      expect(screen.getByText('Maintain at least ₡100,000 in credits for repairs')).toBeInTheDocument();
    });

    it('should show multiple issues when multiple conditions fail', () => {
      renderComponent([], 50_000);

      const list = screen.getByRole('list', { name: /Readiness issues/ });
      const items = within(list).getAllByRole('listitem');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Action Links ──────────────────────────────────────────────────

  describe('Action Links', () => {
    it('should show "Go to Robots page" link for robot issue', () => {
      renderComponent([], 200_000);

      expect(screen.getByText('Go to Robots page')).toBeInTheDocument();
    });

    it('should navigate to /robots when "Go to Robots page" is clicked', async () => {
      const user = userEvent.setup();
      renderComponent([], 200_000);

      await user.click(screen.getByText('Go to Robots page'));
      expect(mockNavigate).toHaveBeenCalledWith('/robots');
    });

    it('should show "Go to Dashboard" link for credit issue', () => {
      const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
      renderComponent(robots, 50_000);

      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    });

    it('should navigate to /dashboard when "Go to Dashboard" is clicked', async () => {
      const user = userEvent.setup();
      const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
      renderComponent(robots, 50_000);

      await user.click(screen.getByText('Go to Dashboard'));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('should have aria-label on the container', () => {
      const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
      renderComponent(robots, 200_000);

      expect(screen.getByLabelText('Battle Readiness Check')).toBeInTheDocument();
    });

    it('should have aria-label on Complete Tutorial button', () => {
      const robots = [makeRobot({ mainWeapon: { id: 1, name: 'Laser Rifle' } })];
      renderComponent(robots, 200_000);

      expect(screen.getByRole('button', { name: /Complete Tutorial/ })).toBeInTheDocument();
    });

    it('should have aria-disabled on disabled button', () => {
      renderComponent([], 200_000);

      const button = screen.getByRole('button', { name: /Complete Tutorial/ });
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('should have issues list with proper role', () => {
      renderComponent([], 200_000);

      expect(screen.getByRole('list', { name: /Readiness issues/ })).toBeInTheDocument();
    });
  });
});
