/**
 * PortraitStep — optional first step of the robot setup wizard.
 * Opens the existing RobotImageSelector straight away: picking an image saves
 * it and moves on, closing the selector skips the step.
 *
 * Requirements: 5.2, 6.1, 6.2, 9.4, 9.5
 */

import { useRef, useState } from 'react';
import RobotImageSelector from '../../RobotImageSelector';
import { updateAppearance } from '../../../utils/robotApi';
import { PANEL } from '../styles';
import type { StepProps } from '../types';

function PortraitStep({ robotId, onComplete, onSkip }: StepProps) {
  const [saving, setSaving] = useState(false);
  // The selector calls onClose right after onSelect; only a close without a
  // pick is a skip (otherwise the wizard advanced twice and skipped the weapon).
  const picked = useRef(false);

  const handleSelect = async (imageUrl: string): Promise<void> => {
    picked.current = true;
    setSaving(true);
    try {
      await updateAppearance(robotId, imageUrl);
    } catch {
      // The portrait is optional; a failed save must not block the setup.
    } finally {
      setSaving(false);
    }
    onComplete();
  };

  return (
    <section className={PANEL} aria-labelledby="portrait-step-heading">
      <h2 id="portrait-step-heading" className="text-lg font-semibold">Choose a portrait</h2>
      <p className="mt-1 text-sm text-secondary">
        Pick a look for your robot, or close the picker to skip. You can change it any time in the Workshop.
      </p>
      {saving && <p className="mt-3 text-sm text-secondary" role="status">Saving portrait…</p>}

      <RobotImageSelector
        isOpen={!saving}
        currentImageUrl={null}
        onSelect={handleSelect}
        onClose={() => { if (!picked.current) onSkip?.(); }}
        robotId={robotId}
      />
    </section>
  );
}

export default PortraitStep;
