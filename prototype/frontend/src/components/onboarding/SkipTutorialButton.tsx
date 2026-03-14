/**
 * SkipTutorialButton component
 * Displays a "Skip Tutorial" button with a confirmation dialog.
 * Can be used standalone or integrated into the OnboardingContainer.
 *
 * Requirements: 1.6, 22.1-22.10
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { skipTutorial } from '../../utils/onboardingApi';

interface SkipTutorialButtonProps {
  /** Called after tutorial is successfully skipped. If not provided, navigates to /dashboard. */
  onSkipped?: () => void;
  /** Additional CSS classes for the button */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

const SkipTutorialButton = ({ onSkipped, className = '', disabled = false }: SkipTutorialButtonProps) => {
  const navigate = useNavigate();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and Escape key for confirmation modal
  useEffect(() => {
    if (!showConfirmation || !modalRef.current) return;

    const modal = modalRef.current;
    const firstButton = modal.querySelector<HTMLElement>('button');
    firstButton?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowConfirmation(false);
        setError(null);
        return;
      }
      if (e.key === 'Tab') {
        const focusable = modal.querySelectorAll<HTMLElement>('button:not([disabled])');
        const arr = Array.from(focusable);
        if (arr.length === 0) return;
        const first = arr[0];
        const last = arr[arr.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showConfirmation]);

  const handleSkipClick = () => {
    setShowConfirmation(true);
    setError(null);
  };

  const handleConfirm = async () => {
    setSkipping(true);
    setError(null);
    try {
      await skipTutorial();
      setShowConfirmation(false);
      if (onSkipped) {
        onSkipped();
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to skip tutorial');
    } finally {
      setSkipping(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setError(null);
  };

  return (
    <>
      <button
        onClick={handleSkipClick}
        disabled={disabled || skipping}
        className={`px-4 py-2 text-sm text-secondary hover:text-secondary border border-gray-600 hover:border-gray-500 rounded transition-colors ${className}`}
        aria-label="Skip Tutorial"
      >
        Skip Tutorial
      </button>

      {showConfirmation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-tutorial-title"
        >
          <div ref={modalRef} className="bg-surface rounded-lg border border-white/10 max-w-md w-full p-6">
            <h3 id="skip-tutorial-title" className="text-xl font-bold mb-4">Skip Tutorial?</h3>
            <p className="text-secondary mb-4">
              Are you sure you want to skip the tutorial? You can always replay it from your profile settings.
            </p>
            {error && (
              <p className="text-error text-sm mb-4" role="alert">{error}</p>
            )}
            <div className="flex gap-4">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-surface-elevated hover:bg-gray-600 rounded transition-colors"
                disabled={skipping}
                aria-label="Cancel skip"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={skipping}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded transition-colors"
                aria-label="Confirm skip tutorial"
              >
                {skipping ? 'Skipping...' : 'Yes, Skip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SkipTutorialButton;
