/**
 * Robot Workshop (#504): owner-only, Build table (upgrades + tuning saved
 * together), Loadout section, switcher and repair. Uses GekkeAap's real
 * numbers (ACC, Nov 2026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const detail = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const store = vi.hoisted(() => ({ robots: [] as unknown[], fetchRobots: vi.fn() }));
const api = vi.hoisted(() => ({
  fetchTuningAllocation: vi.fn(),
  updateTuningAllocation: vi.fn(),
  repairAllRobots: vi.fn(),
}));

vi.mock('../../hooks/useRobotDetail', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useRobotDetail')>('../../hooks/useRobotDetail');
  return { ...actual, useRobotDetail: () => detail.value };
});
vi.mock('../../components/robot-profile/useRobotProfile', () => ({ useRobotProfile: () => ({ profile: null, failed: false }) }));
vi.mock('../../utils/robotApi', () => api);
vi.mock('../../stores', () => ({
  useRobotStore: (selector: (s: typeof store) => unknown) => selector(store),
}));
vi.mock('../../stores/subscriptionStore', () => {
  const state = { overview: null, fetchOverview: vi.fn().mockResolvedValue(undefined) };
  const useSubscriptionStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), { getState: () => state });
  return { useSubscriptionStore };
});
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ refreshUser: vi.fn() }) }));
vi.mock('../../components/BattleConfigTab', () => ({ default: () => <div data-testid="battle-config" /> }));
vi.mock('../../components/RobotImage', () => ({ default: () => <div /> }));
vi.mock('../../components/RobotImageSelector', () => ({ default: () => null }));
vi.mock('../../components/robot-setup/RobotEligibilityChecklist', () => ({ default: () => null }));
vi.mock('../../components/Toast', () => ({ default: () => null }));

import RobotWorkshopPage from '../RobotWorkshopPage';

const ATTRS = {
  combatPower: 45, targetingSystems: 45, criticalSystems: 45, penetration: 45, weaponControl: 44, attackSpeed: 44,
  armorPlating: 42, shieldCapacity: 42, evasionThrusters: 42, damageDampeners: 42, counterProtocols: 42,
  hullIntegrity: 40, servoMotors: 40, gyroStabilizers: 40, hydraulicSystems: 40, powerCore: 40,
  combatAlgorithms: 15, threatAnalysis: 3, adaptiveAI: 2, logicCores: 10,
  syncProtocols: 15, supportSystems: 1, formationTactics: 15,
};

const robot = {
  id: 14451, name: 'GekkeAap', userId: 414, imageUrl: null, elo: 1849, maxHP: 250, maxShield: 239,
  currentHP: 0, currentShield: 239, loadoutType: 'weapon_shield', stance: 'offensive', yieldThreshold: 8,
  mainWeaponId: 1, offhandWeaponId: 2, mainWeapon: null, offhandWeapon: null, ...ATTRS,
};

const commitUpgrades = vi.fn();

function setDetail(overrides: Record<string, unknown> = {}): void {
  detail.value = {
    robot, weapons: [], currency: 1_708_062, loading: false, isOwner: true, isOnboarding: false,
    trainingLevel: 0, rosterCapacity: 11, repairBayLevel: 9,
    academyLevels: { combat_training_academy: 8, defense_training_academy: 7, mobility_training_academy: 6, ai_training_academy: 1 },
    handleCommitUpgrades: commitUpgrades, handleRobotUpdate: vi.fn(), handleEquipWeapon: vi.fn(), handleUnequipWeapon: vi.fn(),
    handleAppearanceChange: vi.fn(), showImageSelector: false, setShowImageSelector: vi.fn(), toast: null, setToast: vi.fn(),
    error: '', successMessage: '', reload: vi.fn(),
    ...overrides,
  };
}

const TUNED = Object.fromEntries(Object.keys(ATTRS).slice(0, 16).map((k) => [k, 5]));

function renderAt(path = '/robots/14451/prepare'): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/robots/:id/prepare" element={<RobotWorkshopPage />} />
        <Route path="/robots/:id" element={<div data-testid="profile" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setDetail();
  store.robots = [
    { id: 14450, name: 'DommeAap', currentHP: 250, maxHP: 250, ...ATTRS },
    { id: 14451, name: 'GekkeAap', currentHP: 0, maxHP: 250, ...ATTRS },
    { id: 14452, name: 'DikkeAap', currentHP: 8, maxHP: 250, ...ATTRS },
  ];
  api.fetchTuningAllocation.mockResolvedValue({ robotId: 14451, facilityLevel: 7, poolSize: 80, allocated: 80, remaining: 0, perAttributeMaxes: {}, allocations: TUNED });
  api.updateTuningAllocation.mockImplementation(async (_id: number, allocations: Record<string, number>) => ({ poolSize: 80, facilityLevel: 7, allocations }));
  commitUpgrades.mockResolvedValue(undefined);
  api.repairAllRobots.mockResolvedValue(undefined);
});

describe('RobotWorkshopPage', () => {
  it('sends visitors to the public profile', () => {
    setDetail({ isOwner: false });
    renderAt();
    expect(screen.getByTestId('profile')).toBeInTheDocument();
  });

  it('asks the owner to reload when the owner fields are missing', () => {
    setDetail({ robot: { ...robot, stance: undefined } });
    renderAt();
    expect(screen.getByTestId('owner-details-unavailable')).toBeInTheDocument();
  });

  it('folds categories that are fully at cap and shows the tuning pool', async () => {
    renderAt();
    expect(await screen.findByText(/80 \/ 80 used/)).toBeInTheDocument();
    const defensive = screen.getByRole('heading', { name: /Defensive Systems/ }).closest('section') as HTMLElement;
    expect(defensive).toHaveTextContent('All 5 at cap 42 · tuned +5 each');
    expect(screen.queryByTestId('build-row-armorPlating')).toBeNull();
    expect(screen.getByTestId('build-row-threatAnalysis')).toBeInTheDocument();
  });

  it('prices a planned upgrade, shows the smaller tuning room, and totals it in the bar', async () => {
    renderAt();
    await screen.findByText(/80 \/ 80 used/);
    const row = screen.getByTestId('build-row-weaponControl');
    fireEvent.click(within(row).getByRole('button', { name: 'Increase Weapon Control level' }));
    expect(row).toHaveTextContent('₡67,500');
    expect(row).toHaveTextContent('6 → 5');
    const bar = screen.getByRole('region', { name: 'Plan summary' });
    expect(bar).toHaveTextContent('₡67,500');
    expect(bar).toHaveTextContent('₡1,640,562');
  });

  it('maxes every open attribute for ₡757,500', async () => {
    renderAt();
    await screen.findByText(/80 \/ 80 used/);
    fireEvent.click(screen.getByRole('button', { name: 'Max upgrades' }));
    expect(screen.getByRole('region', { name: 'Plan summary' })).toHaveTextContent('₡757,500');
  });

  it('maxes one category without touching the others', async () => {
    renderAt();
    await screen.findByText(/80 \/ 80 used/);
    fireEvent.click(within(screen.getByTestId('build-row-logicCores')).getByRole('button', { name: 'Increase Logic Cores level' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade all Combat Systems as far as credits allow' }));

    // Weapon Control and Attack Speed 44 → 45 at ₡67,500 each; the Logic Cores level stays planned.
    expect(screen.getByTestId('build-row-weaponControl')).toHaveTextContent('₡67,500');
    expect(screen.getByTestId('build-row-attackSpeed')).toHaveTextContent('₡67,500');
    expect(screen.getByRole('region', { name: 'Plan summary' })).toHaveTextContent('₡151,500');
    expect(screen.getByRole('button', { name: 'Upgrade all Combat Systems as far as credits allow' })).toBeDisabled();
    // A category already at cap has nothing to max.
    expect(screen.queryByRole('button', { name: 'Upgrade all Defensive Systems as far as credits allow' })).toBeNull();
  });

  it('hides and shows any category, keeping planned upgrades in the summary', async () => {
    renderAt();
    await screen.findByText(/80 \/ 80 used/);
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade all Combat Systems as far as credits allow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide Combat Systems' }));

    expect(screen.queryByTestId('build-row-combatPower')).toBeNull();
    const combat = screen.getByRole('heading', { name: /Combat Systems/ }).closest('section') as HTMLElement;
    expect(combat).toHaveTextContent('4 of 6 at cap 45 · tuned +5 each · ₡135,000 planned');

    fireEvent.click(within(combat).getByRole('button', { name: 'Show Combat Systems' }));
    expect(screen.getByTestId('build-row-combatPower')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide Combat Systems' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('saves upgrades, then tuning, then moves to the next robot', async () => {
    renderAt();
    await screen.findByText(/80 \/ 80 used/);
    const tuneRow = screen.getByTestId('build-row-weaponControl');
    fireEvent.click(within(tuneRow).getByRole('button', { name: 'Decrease Weapon Control tuning' }));
    fireEvent.click(within(screen.getByTestId('build-row-logicCores')).getByRole('button', { name: 'Increase Logic Cores level' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save · next robot ▶' }));

    await waitFor(() => expect(api.updateTuningAllocation).toHaveBeenCalled());
    expect(commitUpgrades).toHaveBeenCalledWith({ logicCores: { currentLevel: 10, plannedLevel: 11, cost: 16_500, baseCost: 16_500 } });
    expect(commitUpgrades.mock.invocationCallOrder[0]).toBeLessThan(api.updateTuningAllocation.mock.invocationCallOrder[0]);
    expect(api.updateTuningAllocation.mock.calls[0][1]).toMatchObject({ weaponControl: 4, combatPower: 5, logicCores: 0 });
  });

  it('shows Loadout with the in-battle table', () => {
    renderAt('/robots/14451/prepare?section=loadout');
    expect(screen.getByTestId('battle-config')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In battle' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'loadout' })).toHaveAttribute('aria-selected', 'true');
  });

  it('pins the robot being edited in a sticky bar', () => {
    renderAt();
    const bar = screen.getByTestId('workshop-robot-bar');
    expect(bar).toHaveClass('sticky');
    expect(within(bar).getByRole('combobox')).toHaveValue('14451');
    expect(within(bar).getByRole('option', { name: 'GekkeAap', selected: true })).toBeInTheDocument();
  });

  it('shows the robot name in the pinned bar when there is nothing to switch to', () => {
    store.robots = [{ id: 14451, name: 'GekkeAap', currentHP: 0, maxHP: 250, ...ATTRS }];
    renderAt();
    expect(screen.getByTestId('workshop-robot-bar')).toHaveTextContent('GekkeAap');
    expect(screen.queryByRole('navigation', { name: 'Switch robot' })).toBeNull();
  });

  it('switches robots with the arrows', () => {
    renderAt();
    expect(screen.getByRole('button', { name: 'Next robot: DikkeAap' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous robot: DommeAap' })).toBeInTheDocument();
  });

  it('starts the next robot with a fresh Workshop instead of carrying the plan over', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt();
    await screen.findByText(/80 \/ 80 used/);
    fireEvent.click(within(screen.getByTestId('build-row-logicCores')).getByRole('button', { name: 'Increase Logic Cores level' }));
    expect(screen.getByRole('region', { name: 'Plan summary' })).toHaveTextContent('₡16,500');

    fireEvent.click(screen.getByRole('button', { name: 'Next robot: DikkeAap' }));

    // Remounted for robot 14452: tuning is fetched again and the old plan is gone.
    await waitFor(() => expect(api.fetchTuningAllocation).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('region', { name: 'Plan summary' })).not.toHaveTextContent('₡16,500');
    expect(screen.getByRole('button', { name: 'Next robot ▶' })).toBeEnabled();
  });

  it('repairs all damaged robots after confirming', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /Repair all damaged/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Repair all' }));
    await waitFor(() => expect(api.repairAllRobots).toHaveBeenCalledTimes(1));
    expect(store.fetchRobots).toHaveBeenCalled();
  });
});
