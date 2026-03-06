import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTutorialState, replayTutorial, TutorialState } from '../utils/onboardingApi';
import ResetAccountModal from './onboarding/ResetAccountModal';

function TutorialSettings() {
  const navigate = useNavigate();
  const [tutorialState, setTutorialState] = useState<TutorialState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    async function fetchState() {
      try {
        setLoading(true);
        setError(null);
        const state = await getTutorialState();
        setTutorialState(state);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load tutorial state');
      } finally {
        setLoading(false);
      }
    }
    fetchState();
  }, []);

  const [replayLoading, setReplayLoading] = useState(false);

  const handleReplayTutorial = async () => {
    try {
      setReplayLoading(true);
      await replayTutorial();
      navigate('/onboarding');
    } catch {
      setError('Failed to start tutorial replay');
    } finally {
      setReplayLoading(false);
    }
  };

  const handleResetComplete = () => {
    setShowResetModal(false);
    navigate('/onboarding');
  };

  const renderStatus = () => {
    if (!tutorialState) return null;

    if (tutorialState.hasCompletedOnboarding) {
      return (
        <div className="flex items-center text-success" data-testid="tutorial-status">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Tutorial Completed
        </div>
      );
    }

    if (tutorialState.onboardingSkipped) {
      return (
        <div className="flex items-center text-warning" data-testid="tutorial-status">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Tutorial Skipped
        </div>
      );
    }

    return (
      <div className="flex items-center text-blue-400" data-testid="tutorial-status">
        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
        Tutorial In Progress – Step {tutorialState.currentStep} of 9
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-surface-elevated p-6 rounded-lg border border-gray-700" data-testid="tutorial-settings">
        <h2 className="text-xl font-semibold mb-4">Tutorial</h2>
        <div className="border-t border-gray-700 mb-4"></div>
        <div className="flex items-center justify-center py-6" data-testid="tutorial-loading">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-400">Loading tutorial status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-elevated p-6 rounded-lg border border-gray-700" data-testid="tutorial-settings">
        <h2 className="text-xl font-semibold mb-4">Tutorial</h2>
        <div className="border-t border-gray-700 mb-4"></div>
        <div className="bg-error/10 border border-error rounded-lg p-4" data-testid="tutorial-error">
          <p className="text-error text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated p-6 rounded-lg border border-gray-700" data-testid="tutorial-settings">
      <h2 className="text-xl font-semibold mb-4">Tutorial</h2>
      <div className="border-t border-gray-700 mb-4"></div>

      <div className="space-y-6">
        {/* Status */}
        <div>
          <div className="text-sm text-gray-400 mb-1">Status</div>
          {renderStatus()}
        </div>

        {/* Replay Tutorial */}
        <div>
          <button
            onClick={handleReplayTutorial}
            disabled={replayLoading}
            className="px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg text-white transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="replay-tutorial-btn"
          >
            {replayLoading ? 'Starting Replay...' : 'Replay Tutorial'}
          </button>
          <p className="text-xs text-gray-400 mt-1">
            Walk through the tutorial again from the beginning.
          </p>
        </div>

        {/* Reset Account */}
        <div>
          <button
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2 bg-error hover:bg-error/80 rounded-lg text-white transition-colors font-medium"
            data-testid="reset-account-btn"
          >
            Reset Account
          </button>
          <p className="text-xs text-gray-400 mt-1">
            Deletes all robots, weapons, and facilities. Resets credits to ₡3,000,000 and restarts the tutorial.
          </p>
        </div>
      </div>

      <ResetAccountModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onResetComplete={handleResetComplete}
      />
    </div>
  );
}

export default TutorialSettings;
