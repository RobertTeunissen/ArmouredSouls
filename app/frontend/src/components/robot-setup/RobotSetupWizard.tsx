/**
 * RobotSetupWizard — the guided setup for a new robot (Spec #47).
 *
 * Shows only the steps the robot still needs (see `planSetupSteps`): portrait,
 * weapon, team (stables with 2+ robots) and events. Every step saves as it
 * goes; finishing or leaving opens the robot's Workshop, where stance, yield,
 * tuning and upgrades live.
 */
import { lazy, Suspense, useState } from 'react';
import { WIZARD_STEP_LABELS, type WizardStepId } from '../../utils/robotSetupSteps';
import { TEXT_LINK } from './styles';
import type { StepProps } from './types';

const PortraitStep = lazy(() => import('./steps/PortraitStep'));
const WeaponEquipStep = lazy(() => import('./steps/WeaponEquipStep'));
const TeamAssignmentStep = lazy(() => import('./steps/TeamAssignmentStep'));
const EventSubscriptionStep = lazy(() => import('./steps/EventSubscriptionStep'));

const STEP_COMPONENTS: Record<WizardStepId, React.ComponentType<StepProps>> = {
  portrait: PortraitStep,
  weapon: WeaponEquipStep,
  team: TeamAssignmentStep,
  events: EventSubscriptionStep,
};

interface RobotSetupWizardProps {
  robotId: number;
  robotName: string;
  loadoutType: string;
  steps: WizardStepId[];
  /** Leave the wizard (finished or skipped) for the robot's Workshop. */
  onExit: () => void;
}

function StepLoadingFallback() {
  return <p className="text-sm text-secondary">Loading…</p>;
}

function SetupProgress({ steps, current }: { steps: WizardStepId[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Setup steps">
      {steps.map((id, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={id} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                active ? 'bg-primary text-background' : done ? 'bg-primary/20 text-primary' : 'bg-surface-elevated text-secondary'
              }`}
              aria-hidden="true"
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={`text-sm ${active ? 'font-semibold text-white' : 'text-secondary'}`}>
              {WIZARD_STEP_LABELS[id]}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RobotSetupWizard({ robotId, robotName, loadoutType, steps, onExit }: RobotSetupWizardProps) {
  const [index, setIndex] = useState(0);
  const step = steps[index];

  const next = (): void => {
    if (index + 1 >= steps.length) onExit();
    else setIndex(index + 1);
  };

  if (!step) return null;
  const Step = STEP_COMPONENTS[step];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {index > 0 ? (
          <button type="button" onClick={() => setIndex(index - 1)} className={TEXT_LINK}>
            ← Back
          </button>
        ) : <span />}
        <button type="button" onClick={onExit} className={TEXT_LINK}>
          Skip setup →
        </button>
      </div>

      <header className="space-y-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Set up {robotName}</h1>
          <p className="mt-1 text-sm text-secondary">
            Step {index + 1} of {steps.length} · {WIZARD_STEP_LABELS[step]}. Everything saves as you go.
          </p>
        </div>
        {steps.length > 1 && <SetupProgress steps={steps} current={index} />}
      </header>

      <Suspense fallback={<StepLoadingFallback />}>
        {/* Keyed so a revisited step starts fresh instead of reusing stale local state. */}
        <Step key={step} robotId={robotId} loadoutType={loadoutType} onComplete={next} onSkip={next} />
      </Suspense>
    </div>
  );
}

export default RobotSetupWizard;
