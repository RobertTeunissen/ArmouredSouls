/**
 * Tests for TuningPoolEditor component (stepper-based UI).
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import TuningPoolEditor from '../TuningPoolEditor';

// ── Mock apiClient ─────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a mock TuningAllocationState response */
function makeTuningState(overrides: Record<string, unknown> = {}) {
  return {
    robotId: 1,
    facilityLevel: 3,
    poolSize: 40,
    allocated: 0,
    remaining: 40,
    perAttributeMaxes: {
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
    },
    allocations: {},
    ...overrides,
  };
}

const defaultRobot = {
  id: 1,
  combatPower: 8,
  targetingSystems: 6,
  criticalSystems: 5,
  penetration: 7,
  weaponControl: 6,
  attackSpeed: 5,
  armorPlating: 10,
  shieldCapacity: 8,
  evasionThrusters: 4,
  damageDampeners: 5,
  counterProtocols: 3,
  hullIntegrity: 9,
  servoMotors: 6,
  gyroStabilizers: 5,
  hydraulicSystems: 7,
  powerCore: 8,
  combatAlgorithms: 6,
  threatAnalysis: 5,
  adaptiveAI: 4,
  logicCores: 5,
  syncProtocols: 3,
  supportSystems: 4,
  formationTactics: 3,
};

function renderEditor(robotOverrides: Record<string, unknown> = {}) {
  return render(
    <TuningPoolEditor
      robotId={1}
      robot={{ ...defaultRobot, ...robotOverrides }}
    />,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('TuningPoolEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with correct pool size showing "0 / 40 allocated"', async () => {
    mockGet.mockResolvedValue({ data: makeTuningState({ poolSize: 40 }) });

    renderEditor();

    await waitFor(() => {
      expect(
        screen.getByText((_content, element) => {
          return element?.tagName === 'SPAN' && element?.textContent === '0 / 40 allocated';
        }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/40 remaining/i)).toBeInTheDocument();
  });

  it('should increment allocation when + button is clicked', async () => {
    mockGet.mockResolvedValue({ data: makeTuningState() });

    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText(/\/ 40 allocated/i)).toBeInTheDocument();
    });

    // Click the + button for Combat Power 5 times
    const incrementBtn = screen.getByLabelText('Increase tuning for Combat Power');
    for (let i = 0; i < 5; i++) {
      await user.click(incrementBtn);
    }

    // The allocation value should show +5
    await waitFor(() => {
      expect(screen.getByText('+5')).toBeInTheDocument();
    });
  });

  it('should update budget bar text after allocating points', async () => {
    mockGet.mockResolvedValue({ data: makeTuningState() });

    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText(/\/ 40 allocated/i)).toBeInTheDocument();
    });

    // Allocate 5 points to Combat Power via + button
    const incrementBtn = screen.getByLabelText('Increase tuning for Combat Power');
    for (let i = 0; i < 5; i++) {
      await user.click(incrementBtn);
    }

    // Budget bar should now show 5 allocated and 35 remaining
    await waitFor(() => {
      expect(
        screen.getByText((_content, element) => {
          return element?.tagName === 'SPAN' && element?.textContent === '5 / 40 allocated';
        }),
      ).toBeInTheDocument();
      expect(screen.getByText(/35 remaining/i)).toBeInTheDocument();
    });
  });

  it('should call PUT API with correct allocations when Save is clicked', async () => {
    const savedState = makeTuningState({
      allocated: 5,
      remaining: 35,
      allocations: { combatPower: 5 },
    });
    mockGet.mockResolvedValue({ data: makeTuningState() });
    mockPut.mockResolvedValue({ data: savedState });

    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText(/\/ 40 allocated/i)).toBeInTheDocument();
    });

    // Allocate 5 points to Combat Power
    const incrementBtn = screen.getByLabelText('Increase tuning for Combat Power');
    for (let i = 0; i < 5; i++) {
      await user.click(incrementBtn);
    }

    // Click Save Tuning
    const saveButton = screen.getByText('Save Tuning');
    await user.click(saveButton);

    // Verify PUT was called with the correct endpoint and allocations
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/api/robots/1/tuning-allocation',
        expect.objectContaining({ combatPower: 5 }),
      );
    });
  });

  it('should reset all allocations to 0 after confirming Reset All', async () => {
    // Start with some allocations already set
    const stateWithAllocations = makeTuningState({
      allocated: 8,
      remaining: 32,
      allocations: { combatPower: 5, armorPlating: 3 },
    });
    mockGet.mockResolvedValue({ data: stateWithAllocations });

    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('+5')).toBeInTheDocument();
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    // Click Reset All (the main button, not the modal one)
    const resetButton = screen.getByRole('button', { name: 'Reset All' });
    await user.click(resetButton);

    // Confirmation modal should appear
    await waitFor(() => {
      expect(screen.getByText('Reset All Tuning')).toBeInTheDocument();
    });

    // Confirm the reset — the modal's confirm button also says "Reset All"
    const modalButtons = screen.getAllByRole('button', { name: 'Reset All' });
    const confirmResetButton = modalButtons[modalButtons.length - 1];
    await user.click(confirmResetButton);

    // All allocations should be 0 — no +N values should be visible
    await waitFor(() => {
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
      expect(screen.queryByText('+3')).not.toBeInTheDocument();
    });

    // Remaining should be back to full pool
    expect(screen.getByText(/40 remaining/i)).toBeInTheDocument();
  });

  it('should enforce per-attribute max by disabling + button at cap', async () => {
    const customMaxes = {
      ...makeTuningState().perAttributeMaxes,
      combatPower: 2,
      formationTactics: 0,
    };
    mockGet.mockResolvedValue({
      data: makeTuningState({ perAttributeMaxes: customMaxes }),
    });

    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText(/\/ 40 allocated/i)).toBeInTheDocument();
    });

    // Click + for Combat Power twice (max is 2)
    const combatIncrement = screen.getByLabelText('Increase tuning for Combat Power');
    await user.click(combatIncrement);
    await user.click(combatIncrement);

    // Should show +2
    expect(screen.getByText('+2')).toBeInTheDocument();

    // Third click should not increase — button should be disabled at max
    expect(combatIncrement).toBeDisabled();

    // Formation Tactics has max 0 — + button should be disabled from the start
    const formationIncrement = screen.getByLabelText('Increase tuning for Formation Tactics');
    expect(formationIncrement).toBeDisabled();
  });

  it('should decrement allocation when − button is clicked', async () => {
    const stateWithAllocations = makeTuningState({
      allocated: 3,
      remaining: 37,
      allocations: { combatPower: 3 },
    });
    mockGet.mockResolvedValue({ data: stateWithAllocations });

    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    // Click − for Combat Power once
    const decrementBtn = screen.getByLabelText('Decrease tuning for Combat Power');
    await user.click(decrementBtn);

    // Should now show +2
    await waitFor(() => {
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.getByText(/38 remaining/i)).toBeInTheDocument();
    });
  });

  it('should disable + buttons when budget is exhausted', async () => {
    // Pool of 2, already allocated 2 to combatPower
    const stateWithFullBudget = makeTuningState({
      poolSize: 2,
      allocated: 2,
      remaining: 0,
      allocations: { combatPower: 2 },
    });
    mockGet.mockResolvedValue({ data: stateWithFullBudget });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    // + button for Armor Plating should be disabled (no budget left)
    const armorIncrement = screen.getByLabelText('Increase tuning for Armor Plating');
    expect(armorIncrement).toBeDisabled();

    // − button for Combat Power should still be enabled
    const combatDecrement = screen.getByLabelText('Decrease tuning for Combat Power');
    expect(combatDecrement).not.toBeDisabled();
  });

  it('should keep budget bar teal when fully allocated', async () => {
    // Pool of 5, fully allocated
    const fullyAllocated = makeTuningState({
      poolSize: 5,
      allocated: 5,
      remaining: 0,
      allocations: { combatPower: 5 },
    });
    mockGet.mockResolvedValue({ data: fullyAllocated });

    const { container } = renderEditor();

    await waitFor(() => {
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    // The budget bar fill should be teal, not amber or red
    const barFill = container.querySelector('.bg-teal-500.h-3.rounded-full');
    expect(barFill).toBeInTheDocument();
    expect(container.querySelector('.bg-amber-500.h-3.rounded-full')).not.toBeInTheDocument();
    expect(container.querySelector('.bg-red-500.h-3.rounded-full')).not.toBeInTheDocument();
  });
});
