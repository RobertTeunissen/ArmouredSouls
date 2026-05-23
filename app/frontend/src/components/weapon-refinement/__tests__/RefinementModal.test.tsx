import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../utils/apiClient', () => ({
  default: {
    post: vi.fn(),
  },
}));

import apiClient from '../../../utils/apiClient';
import { RefinementModal } from '../RefinementModal';
import type { WeaponInventoryItem } from '../../weapon-shop/types';

const baseWeapon: WeaponInventoryItem['weapon'] = {
  id: 1,
  name: 'Volt Sabre',
  weaponType: 'energy',
  loadoutType: 'single',
  handsRequired: 'one',
  description: '',
  rangeBand: 'short',
  baseDamage: 12,
  cost: 425000,
  cooldown: 3,
  combatPowerBonus: 5,
  targetingSystemsBonus: 0,
  criticalSystemsBonus: 0,
  penetrationBonus: 0,
  weaponControlBonus: 0,
  attackSpeedBonus: 3,
  armorPlatingBonus: 0,
  shieldCapacityBonus: 0,
  evasionThrustersBonus: 0,
  counterProtocolsBonus: 0,
  servoMotorsBonus: 0,
  gyroStabilizersBonus: 0,
  hydraulicSystemsBonus: 0,
  powerCoreBonus: 0,
  threatAnalysisBonus: 0,
};

const baseItem: WeaponInventoryItem = {
  id: 99,
  weaponId: 1,
  pricePaid: 425000,
  customName: null,
  purchasedAt: '2026-05-23T00:00:00Z',
  refinements: [],
  weapon: baseWeapon,
};

const shieldItem: WeaponInventoryItem = {
  ...baseItem,
  id: 100,
  weapon: { ...baseWeapon, name: 'Aegis Bulwark', weaponType: 'shield' },
};

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset();
});

describe('RefinementModal', () => {
  it('renders all four tier cards', () => {
    render(
      <RefinementModal
        inventoryItem={baseItem}
        workshopLevel={8}
        userCurrency={5_000_000}
        onCancel={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );

    expect(screen.getByTestId('tier-card-hone')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-augment')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-sharpen')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-forge')).toBeInTheDocument();
  });

  it('locks tiers above the player Workshop level', () => {
    render(
      <RefinementModal
        inventoryItem={baseItem}
        workshopLevel={2}
        userCurrency={5_000_000}
        onCancel={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );
    // Hone (L1) and ... wait, Augment requires L3, Sharpen L5, Forge L8 — at L2 only hone is unlocked
    expect(screen.getByTestId('tier-card-hone')).not.toBeDisabled();
    expect(screen.getByTestId('tier-card-augment')).toBeDisabled();
    expect(screen.getByTestId('tier-card-sharpen')).toBeDisabled();
    expect(screen.getByTestId('tier-card-forge')).toBeDisabled();
  });

  it('disables Sharpen and Forge for shield weapons', () => {
    render(
      <RefinementModal
        inventoryItem={shieldItem}
        workshopLevel={10}
        userCurrency={5_000_000}
        onCancel={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );
    expect(screen.getByTestId('tier-card-hone')).not.toBeDisabled();
    expect(screen.getByTestId('tier-card-augment')).not.toBeDisabled();
    expect(screen.getByTestId('tier-card-sharpen')).toBeDisabled();
    expect(screen.getByTestId('tier-card-forge')).toBeDisabled();
  });

  it('shows the magnitude picker only for Hone/Augment', async () => {
    const user = userEvent.setup();
    render(
      <RefinementModal
        inventoryItem={baseItem}
        workshopLevel={8}
        userCurrency={5_000_000}
        onCancel={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );
    // Pick Sharpen — no magnitude picker
    await user.click(screen.getByTestId('tier-card-sharpen'));
    expect(screen.queryByTestId('magnitude-1')).not.toBeInTheDocument();

    // Pick Hone — magnitude picker appears
    await user.click(screen.getByTestId('tier-card-hone'));
    expect(screen.getByTestId('magnitude-1')).toBeInTheDocument();
    expect(screen.getByTestId('magnitude-5')).toBeInTheDocument();
  });

  it('renders cost preview matching shared formula (Hone +3 → ₡90K)', async () => {
    const user = userEvent.setup();
    render(
      <RefinementModal
        inventoryItem={baseItem}
        workshopLevel={8}
        userCurrency={5_000_000}
        onCancel={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('tier-card-hone'));
    await user.click(screen.getByTestId('magnitude-3'));

    expect(screen.getByTestId('cost-preview')).toHaveTextContent(/₡90,000/);
  });

  it('disables Confirm until a tier and (for hone/augment) attribute are selected', async () => {
    const user = userEvent.setup();
    render(
      <RefinementModal
        inventoryItem={baseItem}
        workshopLevel={8}
        userCurrency={5_000_000}
        onCancel={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );
    expect(screen.getByTestId('confirm-refinement-button')).toBeDisabled();

    await user.click(screen.getByTestId('tier-card-hone'));
    // Still disabled — no attribute picked
    expect(screen.getByTestId('confirm-refinement-button')).toBeDisabled();

    // Select Combat Power
    await user.selectOptions(screen.getByTestId('refine-attribute-select'), 'combatPower');
    expect(screen.getByTestId('confirm-refinement-button')).not.toBeDisabled();
  });

  it('on confirm calls API and forwards updated item + currency upward', async () => {
    const user = userEvent.setup();
    const onConfirmed = vi.fn();
    const onCancel = vi.fn();

    const updatedItem = { ...baseItem, refinements: [{ id: 1, tier: 'forge' as const, magnitude: 1, targetAttribute: null, costPaid: 400000, slotIndex: 1, createdAt: '2026-05-23T00:00:00Z' }] };
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        weaponInventory: updatedItem,
        currency: 4_600_000,
        cost: 400_000,
        message: 'Refined Volt Sabre: forge',
        achievementUnlocks: [],
      },
    });

    render(
      <RefinementModal
        inventoryItem={baseItem}
        workshopLevel={8}
        userCurrency={5_000_000}
        onCancel={onCancel}
        onConfirmed={onConfirmed}
      />,
    );

    await user.click(screen.getByTestId('tier-card-forge'));
    await user.click(screen.getByTestId('confirm-refinement-button'));

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/weapon-inventory/99/refine',
      expect.objectContaining({ tier: 'forge', magnitude: 1 }),
    );
    expect(onConfirmed).toHaveBeenCalledWith(updatedItem, 4_600_000, []);
  });

  it('renders structured server error with stack-cap details', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockRejectedValue({
      response: {
        data: {
          error: 'Combined combatPower bonus would exceed the per-attribute cap of +10.',
          code: 'WEAPON_REFINEMENT_ATTRIBUTE_STACK_CAP_EXCEEDED',
          details: { attribute: 'combatPower', currentTotal: 9, requestedAddition: 3 },
        },
      },
    });

    render(
      <RefinementModal
        inventoryItem={baseItem}
        workshopLevel={8}
        userCurrency={5_000_000}
        onCancel={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('tier-card-hone'));
    await user.selectOptions(screen.getByTestId('refine-attribute-select'), 'combatPower');
    await user.click(screen.getByTestId('magnitude-3'));
    await user.click(screen.getByTestId('confirm-refinement-button'));

    const banner = await screen.findByTestId('error-banner');
    expect(banner).toHaveTextContent(/Combat Power is already at \+9/);
    expect(banner).toHaveTextContent(/\+3 would push past the \+10 cap/);
  });

  it('renders the resale-recovery note', async () => {
    const user = userEvent.setup();
    render(
      <RefinementModal
        inventoryItem={baseItem}
        workshopLevel={5}
        userCurrency={5_000_000}
        onCancel={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('tier-card-hone'));
    expect(screen.getByTestId('cost-preview')).toHaveTextContent(/Refinement spend folds into resale value at your Workshop level \(currently 50%\)/);
  });
});
