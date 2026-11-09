import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '../../utils/ApiError';

const mockRefreshUser = vi.fn().mockResolvedValue(undefined);
const auth = vi.hoisted(() => ({ user: { id: 7, currency: 90000 } as { id: number; currency: number } | null }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, refreshUser: mockRefreshUser }),
}));

const mockGet = vi.fn();
vi.mock('../../utils/api', () => ({ api: { get: (...args: unknown[]) => mockGet(...args) } }));

const robotApi = vi.hoisted(() => ({
  fetchRobotById: vi.fn(),
  updateAppearance: vi.fn(),
  commitUpgrades: vi.fn(),
  equipMainWeapon: vi.fn(),
  equipOffhandWeapon: vi.fn(),
  unequipMainWeapon: vi.fn(),
  unequipOffhandWeapon: vi.fn(),
}));
vi.mock('../../utils/robotApi', () => robotApi);

import { useRobotDetail, isOwnerRobotDetail, type RobotDetail } from '../useRobotDetail';

const ROBOT = {
  id: 3, name: 'Alpha', userId: 7, combatPower: 5, mainWeaponId: null, offhandWeaponId: null, loadoutType: 'single',
  stance: 'balanced', yieldThreshold: 10, mainWeapon: null, offhandWeapon: null, currentHP: 100, currentShield: 0,
  allModesBattleCount: 42,
};

function wrapper(path = '/robots/3') {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/robots/:id" element={<>{children}</>} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 7, currency: 90000 };
  robotApi.fetchRobotById.mockResolvedValue(ROBOT);
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/weapon-inventory') return Promise.resolve([{ id: 1, weapon: { name: 'Laser' } }]);
    if (url === '/api/facilities') {
      return Promise.resolve({
        facilities: [
          { type: 'training_facility', currentLevel: 4 },
          { type: 'repair_bay', currentLevel: 2 },
          { type: 'roster_expansion', currentLevel: 2 },
          { type: 'combat_training_academy', currentLevel: 1 },
        ],
      });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
});

async function loaded(path?: string) {
  const hook = renderHook(() => useRobotDetail(), { wrapper: wrapper(path) });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useRobotDetail', () => {
  it('loads the robot, inventory and facility levels for its owner', async () => {
    const { result } = await loaded();

    expect(robotApi.fetchRobotById).toHaveBeenCalledWith(3);
    expect(result.current.robot?.name).toBe('Alpha');
    expect(result.current.isOwner).toBe(true);
    expect(result.current.allModesBattleCount).toBe(42);
    expect(result.current.weapons).toHaveLength(1);
    expect(result.current.currency).toBe(90000);
    expect(result.current.trainingLevel).toBe(4);
    expect(result.current.repairBayLevel).toBe(2);
    expect(result.current.rosterCapacity).toBe(3);
    expect(result.current.academyLevels).toEqual({
      combat_training_academy: 1, defense_training_academy: 0, mobility_training_academy: 0, ai_training_academy: 0,
    });
    expect(result.current.battleReadiness).toBeDefined();
    // Only the inventory and facilities are read besides the robot.
    expect(mockGet.mock.calls.map(([url]) => url).sort()).toEqual(['/api/facilities', '/api/weapon-inventory']);
  });

  it('is not the owner\'s view for another stable\'s robot', async () => {
    robotApi.fetchRobotById.mockResolvedValue({ ...ROBOT, userId: 99 });
    const { result } = await loaded();
    expect(result.current.isOwner).toBe(false);
    expect(result.current.battleReadiness).toBeUndefined();
  });

  it('keeps the robot when the inventory or facilities fail', async () => {
    mockGet.mockRejectedValue(new Error('down'));
    const { result } = await loaded();
    expect(result.current.robot?.name).toBe('Alpha');
    expect(result.current.error).toBe('');
    expect(result.current.weapons).toEqual([]);
  });

  it('explains a missing robot and other load failures', async () => {
    robotApi.fetchRobotById.mockRejectedValueOnce(new ApiError('Not found', 'ROBOT_NOT_FOUND', 404));
    const missing = await loaded('/robots/8');
    expect(missing.result.current.error).toMatch(/^Robot with ID 8 not found/);

    robotApi.fetchRobotById.mockRejectedValueOnce(new Error('socket'));
    const broken = await loaded();
    expect(broken.result.current.error).toBe('Failed to load robot details');
  });

  it('reflects the onboarding flag from the URL', async () => {
    const { result } = await loaded('/robots/3?onboarding=true');
    expect(result.current.isOnboarding).toBe(true);
  });

  it('equips and unequips weapons from the server response', async () => {
    robotApi.equipMainWeapon.mockResolvedValue({ robot: { ...ROBOT, mainWeaponId: 1 } });
    robotApi.unequipOffhandWeapon.mockResolvedValue({ robot: { ...ROBOT, offhandWeaponId: null } });
    const { result } = await loaded();

    await act(() => result.current.handleEquipWeapon('main', 1));
    expect(robotApi.equipMainWeapon).toHaveBeenCalledWith(3, 1);
    expect(result.current.robot?.mainWeaponId).toBe(1);
    expect(result.current.successMessage).toBe('Weapon equipped successfully!');

    await act(() => result.current.handleUnequipWeapon('offhand'));
    expect(robotApi.unequipOffhandWeapon).toHaveBeenCalledWith(3);
    expect(result.current.successMessage).toBe('Weapon unequipped!');
  });

  it('commits upgrades, refreshes the player and confirms', async () => {
    robotApi.commitUpgrades.mockResolvedValue({ robot: { ...ROBOT, combatPower: 7 } });
    const { result } = await loaded();
    await act(() => result.current.handleCommitUpgrades({ combatPower: { currentLevel: 5, plannedLevel: 7 } }));
    expect(result.current.robot?.combatPower).toBe(7);
    expect(mockRefreshUser).toHaveBeenCalled();
    expect(result.current.toast).toEqual({ message: 'Successfully upgraded 1 attribute!', type: 'success' });
  });

  it('rolls back a failed upgrade, shows the shortfall and reloads', async () => {
    robotApi.commitUpgrades.mockRejectedValue(
      new ApiError('Insufficient credits', 'INSUFFICIENT_CREDITS', 400, { required: 12000, current: 9000 }),
    );
    const { result } = await loaded();
    robotApi.fetchRobotById.mockClear();

    await act(async () => {
      await expect(result.current.handleCommitUpgrades({ combatPower: { currentLevel: 5, plannedLevel: 9 } })).rejects.toThrow();
    });
    expect(result.current.robot?.combatPower).toBe(5);
    expect(result.current.toast).toEqual({
      message: 'Insufficient credits (Required: ₡12,000, Current: ₡9,000)', type: 'error',
    });
    expect(robotApi.fetchRobotById).toHaveBeenCalledTimes(1);
  });

  it('updates the image and reports a failure', async () => {
    robotApi.updateAppearance.mockResolvedValueOnce({ robot: { ...ROBOT, imageUrl: '/img/a.webp' } });
    const { result } = await loaded();
    await act(() => result.current.handleAppearanceChange('/img/a.webp'));
    expect(result.current.robot?.imageUrl).toBe('/img/a.webp');
    expect(result.current.successMessage).toBe('Robot image updated successfully!');

    robotApi.updateAppearance.mockRejectedValueOnce(new ApiError('Access denied', 'FORBIDDEN', 403));
    await act(() => result.current.handleAppearanceChange('/img/other.webp'));
    expect(result.current.error).toBe('Access denied');
  });

  it('merges local configuration changes', async () => {
    const { result } = await loaded();
    act(() => result.current.handleRobotUpdate({ stance: 'offensive' }));
    expect(result.current.robot?.stance).toBe('offensive');
    expect(result.current.successMessage).toBe('Configuration updated successfully!');
  });
});

describe('isOwnerRobotDetail', () => {
  it('needs every owner-only field', () => {
    expect(isOwnerRobotDetail(ROBOT as unknown as RobotDetail)).toBe(true);
    const { stance: _stance, ...sanitized } = ROBOT;
    expect(isOwnerRobotDetail(sanitized as unknown as RobotDetail)).toBe(false);
  });
});
