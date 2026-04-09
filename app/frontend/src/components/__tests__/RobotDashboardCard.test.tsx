import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RobotDashboardCard from '../RobotDashboardCard';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function makeRobot(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    name: 'IronClaw',
    imageUrl: null,
    elo: 1500,
    currentHP: 80,
    maxHP: 100,
    currentShield: 10,
    maxShield: 20,
    currentLeague: 'silver',
    leaguePoints: 45,
    wins: 10,
    losses: 5,
    draws: 2,
    totalBattles: 17,
    mainWeapon: { id: 1, weapon: { name: 'Laser Blade' } },
    offhandWeapon: null,
    loadoutType: 'single',
    fame: 750,
    kills: 8,
    damageDealtLifetime: 12500,
    damageTakenLifetime: 9800,
    ...overrides,
  };
}

function renderCard(props: { robot: ReturnType<typeof makeRobot>; variant?: 'owner' | 'public' }) {
  return render(
    <MemoryRouter>
      <RobotDashboardCard robot={props.robot} variant={props.variant} />
    </MemoryRouter>,
  );
}

describe('RobotDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('public variant', () => {
    it('should render fame value', () => {
      renderCard({ robot: makeRobot(), variant: 'public' });
      expect(screen.getByText('Fame:')).toBeInTheDocument();
      expect(screen.getByText('750')).toBeInTheDocument();
    });

    it('should render fame tier badge', () => {
      // fame=750 → "Famous" tier
      renderCard({ robot: makeRobot({ fame: 750 }), variant: 'public' });
      expect(screen.getByText('Famous')).toBeInTheDocument();
    });

    it('should render kills', () => {
      renderCard({ robot: makeRobot(), variant: 'public' });
      expect(screen.getByText('Kills:')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('should render lifetime damage dealt', () => {
      renderCard({ robot: makeRobot(), variant: 'public' });
      expect(screen.getByText('Dmg Dealt:')).toBeInTheDocument();
      expect(screen.getByText('12,500')).toBeInTheDocument();
    });

    it('should render lifetime damage taken', () => {
      renderCard({ robot: makeRobot(), variant: 'public' });
      expect(screen.getByText('Dmg Taken:')).toBeInTheDocument();
      expect(screen.getByText('9,800')).toBeInTheDocument();
    });

    it('should NOT render HP bar', () => {
      renderCard({ robot: makeRobot(), variant: 'public' });
      // HPBar renders "HP:" label with percentage
      expect(screen.queryByText('HP:')).not.toBeInTheDocument();
    });

    it('should NOT render battle readiness badge', () => {
      renderCard({ robot: makeRobot(), variant: 'public' });
      // BattleReadinessBadge renders "Ready", "Needs Repair", or "No Weapon"
      expect(screen.queryByText('Ready')).not.toBeInTheDocument();
      expect(screen.queryByText('Needs Repair')).not.toBeInTheDocument();
      expect(screen.queryByText('No Weapon')).not.toBeInTheDocument();
    });
  });

  describe('owner variant (default)', () => {
    it('should render HP bar', () => {
      renderCard({ robot: makeRobot() });
      expect(screen.getByText('HP:')).toBeInTheDocument();
    });

    it('should render battle readiness badge', () => {
      // currentHP < maxHP → "Needs Repair"
      renderCard({ robot: makeRobot({ currentHP: 80, maxHP: 100 }) });
      expect(screen.getByText('Needs Repair')).toBeInTheDocument();
    });

    it('should render "Ready" badge when robot is fully healthy with weapon', () => {
      renderCard({ robot: makeRobot({ currentHP: 100, maxHP: 100 }) });
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should NOT render public-only stats (fame, kills, damage)', () => {
      renderCard({ robot: makeRobot() });
      expect(screen.queryByText('Fame:')).not.toBeInTheDocument();
      expect(screen.queryByText('Kills:')).not.toBeInTheDocument();
      expect(screen.queryByText('Dmg Dealt:')).not.toBeInTheDocument();
      expect(screen.queryByText('Dmg Taken:')).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should navigate to /robots/:id when card is clicked', async () => {
      const user = userEvent.setup();
      renderCard({ robot: makeRobot({ id: 42 }), variant: 'public' });

      const card = screen.getByRole('button');
      await user.click(card);

      expect(mockNavigate).toHaveBeenCalledWith('/robots/42');
    });

    it('should navigate to /robots/:id when Enter key is pressed', async () => {
      const user = userEvent.setup();
      renderCard({ robot: makeRobot({ id: 99 }), variant: 'owner' });

      const card = screen.getByRole('button');
      card.focus();
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith('/robots/99');
    });
  });
});
