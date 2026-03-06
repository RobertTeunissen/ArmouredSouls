import React, { useState, useEffect } from 'react';

interface ResetBlocker {
  type: string;
  message: string;
}

interface ResetAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetComplete: () => void;
}

const ResetAccountModal: React.FC<ResetAccountModalProps> = ({
  isOpen,
  onClose,
  onResetComplete,
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [blockers, setBlockers] = useState<ResetBlocker[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check reset eligibility when modal opens
  useEffect(() => {
    if (isOpen) {
      checkResetEligibility();
      setConfirmationText('');
      setError(null);
    }
  }, [isOpen]);

  const checkResetEligibility = async () => {
    setIsCheckingEligibility(true);
    try {
      const response = await fetch('/api/onboarding/reset-eligibility', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setCanReset(data.data.canReset);
        if (!data.data.canReset) {
          // Parse blockers from the API response
          const blockerTypes = data.data.blockers || [];
          const blockerDetails: ResetBlocker[] = blockerTypes.map((type: string) => ({
            type,
            message: getBlockerMessage(type),
          }));
          setBlockers(blockerDetails);
        } else {
          setBlockers([]);
        }
      } else {
        setError('Failed to check reset eligibility');
      }
    } catch (err) {
      setError('Failed to check reset eligibility');
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const getBlockerMessage = (type: string): string => {
    const messages: Record<string, string> = {
      scheduled_battles: 'You have scheduled battles. Removing robots would create conflicts.',
      active_tournament: 'You are participating in an active tournament.',
      pending_battles: 'You have recent battle results being processed.',
      facility_construction: 'You have facilities under construction.',
    };
    return messages[type] || 'Unknown blocker';
  };

  const handleReset = async () => {
    if (confirmationText !== 'RESET' && confirmationText !== 'START OVER') {
      setError('Please type "RESET" or "START OVER" to confirm');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/reset-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          confirmation: confirmationText,
          reason: 'User requested reset from onboarding',
        }),
      });

      const data = await response.json();

      if (data.success) {
        onResetComplete();
      } else {
        setError(data.error || 'Failed to reset account');
      }
    } catch (err) {
      setError('Failed to reset account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black bg-opacity-75"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full mx-4 border border-gray-700 animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white">Reset Account</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {isCheckingEligibility ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-300">Checking eligibility...</span>
            </div>
          ) : !canReset ? (
            <div>
              <div className="bg-error/10 border border-error rounded-lg p-4 mb-4">
                <h4 className="text-error font-semibold mb-2">Cannot Reset Account</h4>
                <p className="text-gray-300 text-sm mb-3">
                  Your account cannot be reset at this time due to the following reasons:
                </p>
                <ul className="space-y-2">
                  {blockers.map((blocker, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-error mr-2 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-300 text-sm">{blocker.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-gray-400 text-sm">
                Please wait for these conditions to clear before attempting to reset your account.
              </p>
            </div>
          ) : (
            <div>
              {/* Warning Section */}
              <div className="bg-warning/10 border border-warning rounded-lg p-4 mb-4">
                <h4 className="text-warning font-semibold mb-2 flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Warning: This Action Cannot Be Undone
                </h4>
                <p className="text-gray-300 text-sm">
                  Resetting your account will permanently delete:
                </p>
              </div>

              {/* Consequences List */}
              <ul className="space-y-2 mb-4">
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-error mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-300 text-sm">
                    <strong>All your robots</strong> and their battle history
                  </span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-error mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-300 text-sm">
                    <strong>All your weapons</strong> and equipment
                  </span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-error mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-300 text-sm">
                    <strong>All your facilities</strong> and upgrades
                  </span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-success mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-300 text-sm">
                    Your credits will be reset to <strong>₡3,000,000</strong>
                  </span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-success mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-300 text-sm">
                    You will restart the tutorial from <strong>Step 1</strong>
                  </span>
                </li>
              </ul>

              {/* Confirmation Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type <span className="text-error font-bold">"RESET"</span> or{' '}
                  <span className="text-error font-bold">"START OVER"</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type RESET or START OVER"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  disabled={isLoading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-error/10 border border-error rounded-lg p-3 mb-4">
                  <p className="text-error text-sm">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          {canReset && !isCheckingEligibility && (
            <button
              onClick={handleReset}
              disabled={
                isLoading ||
                (confirmationText !== 'RESET' && confirmationText !== 'START OVER')
              }
              className="px-4 py-2 rounded-lg bg-error hover:bg-error/80 text-white transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Resetting...' : 'Reset Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetAccountModal;
