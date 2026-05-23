import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomNameEditor } from '../CustomNameEditor';
import type { WeaponInventoryItem } from '../../weapon-shop/types';

const baseItem: WeaponInventoryItem = {
  id: 1,
  weaponId: 1,
  pricePaid: 100000,
  customName: null,
  purchasedAt: '2026-05-23T00:00:00Z',
  refinements: [],
  weapon: {
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
    combatPowerBonus: 0,
    targetingSystemsBonus: 0,
    criticalSystemsBonus: 0,
    penetrationBonus: 0,
    weaponControlBonus: 0,
    attackSpeedBonus: 0,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 0,
    evasionThrustersBonus: 0,
    counterProtocolsBonus: 0,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 0,
    threatAnalysisBonus: 0,
  },
};

describe('CustomNameEditor', () => {
  it('renders the placeholder in display mode when customName is null', () => {
    render(<CustomNameEditor inventoryItem={baseItem} onSave={vi.fn()} />);
    expect(screen.getByTestId('custom-name-editor-display')).toHaveTextContent(/Set name/);
  });

  it('renders the current name in display mode when customName is set', () => {
    render(
      <CustomNameEditor
        inventoryItem={{ ...baseItem, customName: 'Old Faithful' }}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('custom-name-editor-display')).toHaveTextContent(/Old Faithful/);
  });

  it('switches to edit mode on click', async () => {
    render(<CustomNameEditor inventoryItem={baseItem} onSave={vi.fn()} />);
    await userEvent.click(screen.getByTestId('custom-name-editor-display'));
    expect(screen.getByTestId('custom-name-editor-edit')).toBeInTheDocument();
    expect(screen.getByTestId('custom-name-editor-input')).toBeInTheDocument();
  });

  it('calls onSave with the trimmed value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CustomNameEditor inventoryItem={baseItem} onSave={onSave} />);
    await userEvent.click(screen.getByTestId('custom-name-editor-display'));

    const input = screen.getByTestId('custom-name-editor-input');
    await userEvent.type(input, '  Old Faithful  ');
    await userEvent.click(screen.getByTestId('custom-name-editor-save'));

    expect(onSave).toHaveBeenCalledWith('Old Faithful');
  });

  it('calls onSave with null when clearing a previously-set name', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CustomNameEditor
        inventoryItem={{ ...baseItem, customName: 'Old Faithful' }}
        onSave={onSave}
      />,
    );
    await userEvent.click(screen.getByTestId('custom-name-editor-display'));

    const input = screen.getByTestId('custom-name-editor-input');
    await userEvent.clear(input);
    await userEvent.click(screen.getByTestId('custom-name-editor-save'));

    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('rejects names with disallowed characters', async () => {
    const onSave = vi.fn();
    render(<CustomNameEditor inventoryItem={baseItem} onSave={onSave} />);
    await userEvent.click(screen.getByTestId('custom-name-editor-display'));

    const input = screen.getByTestId('custom-name-editor-input');
    await userEvent.type(input, 'Bad<Name>');
    await userEvent.click(screen.getByTestId('custom-name-editor-save'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('custom-name-editor-error')).toBeInTheDocument();
  });

  it('renders server error from a 429 rate-limit response', async () => {
    const onSave = vi.fn().mockRejectedValue({
      response: { data: { error: 'Too many custom name edits. Try again later.' } },
    });
    render(<CustomNameEditor inventoryItem={baseItem} onSave={onSave} />);
    await userEvent.click(screen.getByTestId('custom-name-editor-display'));

    const input = screen.getByTestId('custom-name-editor-input');
    await userEvent.type(input, 'Old Faithful');
    await userEvent.click(screen.getByTestId('custom-name-editor-save'));

    expect(await screen.findByTestId('custom-name-editor-error')).toHaveTextContent(/Too many custom name edits/);
  });

  it('cancels and restores the previous value', async () => {
    render(
      <CustomNameEditor
        inventoryItem={{ ...baseItem, customName: 'Old Faithful' }}
        onSave={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByTestId('custom-name-editor-display'));

    const input = screen.getByTestId('custom-name-editor-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'Should Not Save');
    await userEvent.click(screen.getByTestId('custom-name-editor-cancel'));

    // Back to display mode showing the original name
    expect(screen.getByTestId('custom-name-editor-display')).toHaveTextContent(/Old Faithful/);
  });
});
