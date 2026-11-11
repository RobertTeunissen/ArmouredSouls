/**
 * Tests for the RobotSetupWizard shell: only the planned steps, progress,
 * Back, Skip setup, and handing over to the Workshop after the last step.
 *
 * Requirements: 3.1, 4.5, 4.6, 5.1, 9.1, 10.4, 11.2, 11.3
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RobotSetupWizard from '../RobotSetupWizard';
import type { WizardStepId } from '../../../utils/robotSetupSteps';
import type { StepProps } from '../types';

function fakeStep(title: string) {
  return {
    default: ({ onComplete, onSkip }: StepProps) => (
      <div>
        <h2>{title}</h2>
        <button type="button" onClick={onComplete}>Complete step</button>
        <button type="button" onClick={onSkip}>Skip step</button>
      </div>
    ),
  };
}
vi.mock('../steps/PortraitStep', () => fakeStep('Choose a portrait'));
vi.mock('../steps/WeaponEquipStep', () => fakeStep('Equip a weapon'));
vi.mock('../steps/TeamAssignmentStep', () => fakeStep('Form a team'));
vi.mock('../steps/EventSubscriptionStep', () => fakeStep('Enter battle events'));

function renderWizard(steps: WizardStepId[], onExit = vi.fn()) {
  render(<RobotSetupWizard robotId={1} robotName="TestBot" loadoutType="single" steps={steps} onExit={onExit} />);
  return onExit;
}

describe('RobotSetupWizard', () => {
  it('shows the first planned step with the step count and the robot name', async () => {
    renderWizard(['portrait', 'weapon', 'events']);

    expect(await screen.findByRole('heading', { name: 'Choose a portrait' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Set up TestBot' })).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 3 · Portrait/)).toBeInTheDocument();

    const progress = screen.getByRole('list', { name: 'Setup steps' });
    expect(progress.querySelectorAll('li')).toHaveLength(3);
    expect(progress.querySelector('[aria-current="step"]')).toHaveTextContent('Portrait');
  });

  it('moves on after a completed or skipped step, and Back returns', async () => {
    const user = userEvent.setup();
    renderWizard(['portrait', 'weapon', 'events']);

    await user.click(await screen.findByRole('button', { name: 'Skip step' }));
    expect(await screen.findByRole('heading', { name: 'Equip a weapon' })).toBeInTheDocument();
    expect(screen.getByText(/Step 2 of 3 · Weapon/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Complete step' }));
    expect(await screen.findByRole('heading', { name: 'Enter battle events' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← Back' }));
    expect(await screen.findByRole('heading', { name: 'Equip a weapon' })).toBeInTheDocument();
  });

  it('opens the Workshop after the last step', async () => {
    const user = userEvent.setup();
    const onExit = renderWizard(['events']);

    await user.click(await screen.findByRole('button', { name: 'Complete step' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('leaves at any point with Skip setup, and has no Back on the first step', async () => {
    const user = userEvent.setup();
    const onExit = renderWizard(['weapon', 'events']);

    await screen.findByRole('heading', { name: 'Equip a weapon' });
    expect(screen.queryByRole('button', { name: '← Back' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip setup →' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('hides the progress list for a single step', async () => {
    renderWizard(['events']);
    await screen.findByRole('heading', { name: 'Enter battle events' });
    expect(screen.queryByRole('list', { name: 'Setup steps' })).not.toBeInTheDocument();
  });
});
