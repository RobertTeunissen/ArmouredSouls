import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock shared utils (resolved relative to the source file's imports)
vi.mock('../../../../../shared/utils/academyCaps', () => ({
  getCapForLevel: vi.fn(() => 10),
}));

vi.mock('../../../../../shared/utils/upgradeCosts', () => ({
  calculateBaseCost: vi.fn(() => 1500),
}));

vi.mock('../../../../../shared/utils/discounts', () => ({
  calculateTrainingFacilityDiscount: vi.fn(() => 10),
}));

import { WhatIfPanel } from '../WhatIfPanel';
import type { OwnedRobot, WhatIfOverrides, AcademyLevels } from '../types';

const makeRobot = (overrides: Partial<OwnedRobot> = {}): OwnedRobot => ({
  id: 1,
  name: 'TestBot',
  combatPower: 10,
  targetingSystems: 10,
  criticalSystems: 10,
  penetration: 10,
  weaponControl: 10,
  attackSpeed: 10,
  armorPlating: 10,
  shieldCapacity: 10,
  evasionThrusters: 10,
  damageDampeners: 10,
  counterProtocols: 10,
  hullIntegrity: 10,
  servoMotors: 10,
  gyroStabilizers: 10,
  hydraulicSystems: 10,
  powerCore: 10,
  combatAlgorithms: 10,
  threatAnalysis: 10,
  adaptiveAI: 10,
  logicCores: 10,
  syncProtocols: 10,
  supportSystems: 10,
  formationTactics: 10,
  loadoutType: 'single',
  stance: 'balanced',
  yieldThreshold: 10,
  ...overrides,
});

const defaultAcademyLevels: AcademyLevels = {
  combat_training_academy: 1,
  defense_training_academy: 1,
  mobility_training_academy: 1,
  ai_training_academy: 1,
};

const defaultOverrides: WhatIfOverrides = {};

function renderPanel(props: Partial<Parameters<typeof WhatIfPanel>[0]> = {}) {
  const onChange = props.onChange ?? vi.fn();
  return {
    onChange,
    ...render(
      <WhatIfPanel
        robot={props.robot ?? makeRobot()}
        overrides={props.overrides ?? defaultOverrides}
        onChange={onChange}
        trainingLevel={props.trainingLevel ?? 1}
        academyLevels={props.academyLevels ?? defaultAcademyLevels}
      />,
    ),
  };
}

describe('WhatIfPanel', () => {
  it('renders collapsed by default — toggle button visible, no stance/yield controls', () => {
    renderPanel();

    expect(screen.getByText(/What-If Configuration/)).toBeInTheDocument();
    // Stance and yield controls should NOT be visible when collapsed
    expect(screen.queryByText('Stance')).not.toBeInTheDocument();
    expect(screen.queryByText(/Yield:/)).not.toBeInTheDocument();
  });

  it('expands on button click — shows stance/yield controls and attribute categories', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText(/What-If Configuration/));

    // Stance select and yield slider should now be visible
    expect(screen.getByText('Stance')).toBeInTheDocument();
    expect(screen.getByText(/Yield:/)).toBeInTheDocument();

    // Category headers should be visible
    expect(screen.getByText('Combat Systems')).toBeInTheDocument();
    expect(screen.getByText('Defensive Systems')).toBeInTheDocument();
    expect(screen.getByText('Chassis & Mobility')).toBeInTheDocument();
    expect(screen.getByText('AI Processing')).toBeInTheDocument();
    expect(screen.getByText('Team Coordination')).toBeInTheDocument();
  });

  it('displays attribute values from robot prop when expanded', async () => {
    const user = userEvent.setup();
    renderPanel({ robot: makeRobot({ combatPower: 7, armorPlating: 5 }) });

    await user.click(screen.getByText(/What-If Configuration/));

    // Attribute labels should be present
    expect(screen.getByText('Combat Power')).toBeInTheDocument();
    expect(screen.getByText('Armor Plating')).toBeInTheDocument();

    // Values should reflect the robot prop (floor of the number)
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('reset button calls onChange to clear overrides', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const overrides: WhatIfOverrides = {
      attributes: { combatPower: 15 },
    };

    renderPanel({ overrides, onChange });

    await user.click(screen.getByText(/What-If Configuration/));

    const resetButton = screen.getByText('Reset All');
    await user.click(resetButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: undefined,
        simulatedAcademyLevels: undefined,
      }),
    );
  });
});
