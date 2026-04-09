import { Component, ReactNode } from 'react';
import { trackError } from '../../utils/onboardingAnalytics';

interface Props {
  children: ReactNode;
  /** Optional callback when the user clicks "Retry" */
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that wraps onboarding components.
 * Catches render-time exceptions and displays a recovery UI
 * with a retry button instead of crashing the whole app.
 */
class OnboardingErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    trackError(0, error.message, 'OnboardingErrorBoundary');
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-[300px] flex items-center justify-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="text-center max-w-md mx-auto p-6">
            <h2 className="text-xl font-bold text-error mb-2">
              Something went wrong
            </h2>
            <p className="text-secondary mb-4">
              An unexpected error occurred in the tutorial. Your progress has been saved.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-2 bg-primary hover:bg-primary-dark rounded transition-colors text-white"
              >
                Try Again
              </button>
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                className="px-6 py-2 border border-gray-600 hover:border-gray-400 rounded transition-colors text-secondary"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default OnboardingErrorBoundary;
