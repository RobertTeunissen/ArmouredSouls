/**
 * Status screens shown by OnboardingContainer for loading, error,
 * already-completed, and missing-state conditions.
 * Extracted to keep OnboardingContainer focused on step orchestration.
 */

interface ErrorScreenProps {
  error: string;
  isNetwork: boolean;
  onRetry: () => void;
}

export const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="text-xl text-secondary">Loading tutorial...</div>
    </div>
  </div>
);

export const ErrorScreen = ({ error, isNetwork, onRetry }: ErrorScreenProps) => (
  <div className="min-h-screen bg-background flex items-center justify-center" role="alert">
    <div className="text-center max-w-md mx-auto p-6">
      <h2 className="text-xl font-bold text-error mb-2">
        {isNetwork ? 'Connection Problem' : 'Failed to Load Tutorial'}
      </h2>
      <p className="text-secondary mb-4">
        {isNetwork
          ? 'Unable to reach the server. Please check your internet connection.'
          : error}
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-primary hover:bg-primary-dark rounded transition-colors text-white min-h-[44px]"
        >
          Retry
        </button>
        <button
          onClick={() => { window.location.href = '/dashboard'; }}
          className="px-6 py-2 border border-gray-600 hover:border-gray-400 rounded transition-colors text-secondary min-h-[44px]"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  </div>
);

export const CompletedScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-gray-100">Tutorial Already Completed</h2>
      <p className="text-secondary mb-6">
        You've already completed the onboarding tutorial.
      </p>
      <button
        onClick={() => window.location.href = '/dashboard'}
        className="px-6 py-2 bg-primary hover:bg-primary-dark rounded transition-colors min-h-[44px]"
      >
        Go to Dashboard
      </button>
    </div>
  </div>
);

export const NoStateScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="text-xl text-secondary">No tutorial state found</div>
    </div>
  </div>
);
