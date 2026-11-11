import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WeaponEquipStep from '../WeaponEquipStep';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), equip: vi.fn(), navigate: vi.fn() }));
vi.mock('../../../../utils/api', () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock('../../../../utils/robotApi', () => ({ equipMainWeapon: mocks.equip }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

const weapon = (id: number, name: string, cost: number, handsRequired = 'one') => ({
  id, name, cost, handsRequired, weaponType: 'energy', baseDamage: 10, rangeBand: 'mid',
});
const SHOP = [
  weapon(1, 'Practice Blaster', 50_000),
  weapon(2, 'Training Beam', 60_000),
  weapon(3, 'Heavy Cannon', 300_000, 'two'),
  weapon(4, 'Combat Shield', 40_000, 'shield'),
  weapon(5, 'Plasma Rifle', 900_000),
];

function setup({ inventory = [] as unknown[], currency = 2_500_000, isFull = false } = {}) {
  mocks.get.mockImplementation(async (url: string) => {
    if (url === '/api/weapon-inventory') return inventory;
    if (url === '/api/weapon-inventory/storage-status') return { currentWeapons: inventory.length, maxCapacity: 5, isFull };
    if (url === '/api/user/profile') return { currency };
    if (url === '/api/weapons') return SHOP;
    throw new Error(`unexpected ${url}`);
  });
}

function renderStep(onComplete = vi.fn()) {
  render(
    <MemoryRouter>
      <WeaponEquipStep robotId={9} loadoutType="single" onComplete={onComplete} onSkip={vi.fn()} />
    </MemoryRouter>,
  );
  return onComplete;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockResolvedValue({ weaponInventory: { id: 77 } });
  mocks.equip.mockResolvedValue({});
});

describe('WeaponEquipStep', () => {
  it('buys and equips a weapon in one click, cheapest compatible first', async () => {
    setup();
    const user = userEvent.setup();
    const onComplete = renderStep();

    const buttons = await screen.findAllByRole('button', { name: /^Buy and equip/ });
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Buy and equip Practice Blaster for ₡50,000',
      'Buy and equip Training Beam for ₡60,000',
      'Buy and equip Plasma Rifle for ₡900,000',
    ]);

    await user.click(buttons[0]);
    expect(mocks.post).toHaveBeenCalledWith('/api/weapon-inventory/purchase', { weaponId: 1 });
    expect(mocks.equip).toHaveBeenCalledWith(9, 77);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('equips a spare weapon from storage instead of buying', async () => {
    setup({ inventory: [{ id: 31, weapon: weapon(1, 'Practice Blaster', 50_000), equippedOnRobotMain: null, equippedOnRobotOffhand: null }] });
    const user = userEvent.setup();
    const onComplete = renderStep();

    await user.click(await screen.findByRole('button', { name: 'Equip Practice Blaster' }));
    expect(mocks.equip).toHaveBeenCalledWith(9, 31);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it('points to Facilities when storage is full', async () => {
    setup({ isFull: true });
    const user = userEvent.setup();
    renderStep();

    expect(await screen.findByText('Weapon storage is full')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to Facilities' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/facilities');
  });

  it('says so when no weapon is affordable', async () => {
    setup({ currency: 10_000 });
    renderStep();
    expect(await screen.findByText('Not enough credits for a weapon')).toBeInTheDocument();
  });

  it('keeps the player on the step when the purchase fails', async () => {
    setup();
    mocks.post.mockRejectedValue(new Error('Insufficient credits'));
    const user = userEvent.setup();
    const onComplete = renderStep();

    await user.click((await screen.findAllByRole('button', { name: /^Buy and equip/ }))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient credits');
    expect(onComplete).not.toHaveBeenCalled();
  });
});
