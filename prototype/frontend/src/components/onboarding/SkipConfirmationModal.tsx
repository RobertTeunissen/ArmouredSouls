/**
 * SkipConfirmationModal component
 * Displays a confirmation dialog when the user wants to skip the onboarding tutorial.
 *
 * Requirements: 1.6, 22.1-22.10
 */

import { RefObject } from 'react';

interface SkipConfirmationModalProps {
  modalRef: RefObject<HTMLDivElement>;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

const SkipConfirmationModal = ({ modalRef, onCancel, onConfirm, loading }: SkipConfirmationModalProps) => (
  <div
    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="skip-confirm-title"
    aria-describedby="skip-confirm-desc"
  >
    <div ref={modalRef} className="bg-surface rounded-lg border border-gray-700 max-w-md w-full p-6">
      <h3 id="skip-confirm-title" className="text-xl font-bold mb-4 text-gray-100">Skip Tutorial?</h3>
      <div id="skip-confirm-desc">
        <p className="text-gray-300 mb-6">
          Are you sure you want to skip the tutorial? You'll miss important guidance about:
        </p>
        <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2" role="list">
          <li>Roster strategy selection (1, 2, or 3 robots)</li>
          <li>Facility timing and priorities</li>
          <li>Budget allocation guidance</li>
          <li>Weapon loadout configurations</li>
          <li>Battle readiness requirements</li>
        </ul>
        <p className="text-sm text-gray-300 mb-6">
          You can always reset your account later if you make mistakes.
        </p>
      </div>
      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors min-h-[44px]"
          aria-label="Continue tutorial"
        >
          Continue Tutorial
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors min-h-[44px]"
          disabled={loading}
          aria-label="Confirm skip tutorial"
        >
          Skip Anyway
        </button>
      </div>
    </div>
  </div>
);

export default SkipConfirmationModal;
