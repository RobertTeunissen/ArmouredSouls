/**
 * RobotNamingModal component
 * Modal that prompts the user to name their robot(s) during onboarding.
 * Shown after strategy selection, before automatic robot creation.
 */

import { useState, useEffect, useRef } from 'react';

interface RobotNamingModalProps {
  robotCount: number;
  onConfirm: (names: string[]) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
}

const RobotNamingModal = ({ robotCount, onConfirm, onCancel, isSubmitting, error }: RobotNamingModalProps) => {
  const [names, setNames] = useState<string[]>(() => Array(robotCount).fill(''));
  const firstInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus first input on mount
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Trap focus inside modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, isSubmitting]);

  const handleNameChange = (index: number, value: string) => {
    setNames(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const allNamesValid = names.every(n => n.trim().length >= 1 && n.trim().length <= 50);
  const hasDuplicates = new Set(names.map(n => n.trim().toLowerCase())).size !== names.length;
  const canSubmit = allNamesValid && !hasDuplicates && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onConfirm(names.map(n => n.trim()));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Name your robots"
    >
      <div
        ref={modalRef}
        className="bg-surface border border-white/10 rounded-lg shadow-2xl w-full max-w-lg mx-4 p-6"
      >
        <h2 className="text-2xl font-bold text-gray-100 mb-2">
          Name Your Robot{robotCount > 1 ? 's' : ''}
        </h2>
        <p className="text-secondary text-sm mb-6">
          {robotCount === 1
            ? 'Choose a name for your combat robot. Make it count — this is your only fighter.'
            : `Choose names for your ${robotCount} combat robots. Each name must be unique.`}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 mb-6">
            {names.map((name, i) => (
              <div key={i}>
                <label
                  htmlFor={`robot-name-${i}`}
                  className="block text-sm font-medium text-gray-200 mb-1"
                >
                  Robot {robotCount > 1 ? `#${i + 1}` : ''} Name
                </label>
                <input
                  ref={i === 0 ? firstInputRef : undefined}
                  id={`robot-name-${i}`}
                  type="text"
                  value={name}
                  onChange={e => handleNameChange(i, e.target.value)}
                  disabled={isSubmitting}
                  maxLength={50}
                  placeholder={`Enter robot name${robotCount > 1 ? ` #${i + 1}` : ''}`}
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                  autoComplete="off"
                />
              </div>
            ))}
          </div>

          {hasDuplicates && (
            <p className="text-error text-sm mb-4">Each robot must have a unique name.</p>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-surface-elevated hover:bg-gray-600 text-secondary rounded-lg font-medium transition-colors min-h-[44px] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`
                px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 min-h-[44px]
                ${canSubmit
                  ? 'bg-primary hover:bg-blue-700 text-white shadow-lg'
                  : 'bg-surface-elevated text-secondary cursor-not-allowed'
                }
              `}
            >
              {isSubmitting ? 'Creating...' : `Create Robot${robotCount > 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RobotNamingModal;
