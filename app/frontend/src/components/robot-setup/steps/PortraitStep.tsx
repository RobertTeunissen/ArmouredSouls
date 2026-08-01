/**
 * PortraitStep — Step 1 of the robot setup wizard.
 * Wraps the existing RobotImageSelector to let the player choose a portrait.
 *
 * Requirements: 5.2, 6.1, 6.2, 9.4, 9.5
 */

import { useState } from 'react';
import RobotImageSelector from '../../RobotImageSelector';
import { updateAppearance } from '../../../utils/robotApi';
import type { StepProps } from '../types';

function PortraitStep({ robotId, onComplete, onSkip }: StepProps) {
  const [showSelector, setShowSelector] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (imageUrl: string): Promise<void> => {
    setSaving(true);
    try {
      await updateAppearance(robotId, imageUrl);
      onComplete();
    } catch {
      // If image update fails, still allow advancing (portrait is optional)
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (): void => {
    setShowSelector(false);
    // Skipping portrait selection
    if (onSkip) onSkip();
  };

  if (!showSelector) return null;

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">Choose a Portrait</h2>
        <p className="text-secondary text-sm mt-1">
          Pick a look for your robot. You can always change this later from the robot detail page.
        </p>
      </div>

      <RobotImageSelector
        isOpen={true}
        currentImageUrl={null}
        onSelect={handleSelect}
        onClose={handleClose}
        robotId={robotId}
      />

      {saving && (
        <div className="text-center text-secondary text-sm">Saving portrait...</div>
      )}
    </div>
  );
}

export default PortraitStep;
