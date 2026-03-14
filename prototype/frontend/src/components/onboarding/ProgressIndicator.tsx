/**
 * ProgressIndicator component
 * Displays current step and progress through the onboarding tutorial.
 * 
 * Features:
 * - Display current step and total steps (e.g., "Step 3 of 9")
 * - Show visual progress bar
 * - Highlight completed steps
 * 
 * Requirements: 2.4
 */

interface ProgressIndicatorProps {
  current: number;
  total: number;
}

const ProgressIndicator = ({ current, total }: ProgressIndicatorProps) => {
  // Calculate progress percentage
  const progressPercentage = (current / total) * 100;

  // Generate step indicators
  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="w-full" role="navigation" aria-label="Tutorial progress">
      {/* Text indicator - more compact */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-medium text-secondary" id="progress-label">
          Step {current} of {total}
        </div>
        <div className="text-xs text-secondary" aria-hidden="true">
          {Math.round(progressPercentage)}%
        </div>
      </div>

      {/* Progress bar - smaller */}
      <div className="relative">
        {/* Background bar */}
        <div
          className="h-1.5 bg-surface-elevated rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-labelledby="progress-label"
          aria-valuetext={`Step ${current} of ${total}, ${Math.round(progressPercentage)}% complete`}
        >
          {/* Progress fill */}
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Step dots - smaller */}
        <div className="absolute top-0 left-0 right-0 flex justify-between items-center h-1.5" aria-hidden="true">
          {steps.map((step) => {
            const isCompleted = step < current;
            const isCurrent = step === current;
            const isUpcoming = step > current;

            return (
              <div
                key={step}
                className="relative flex items-center justify-center"
                style={{ marginLeft: step === 1 ? '0' : '-6px' }}
              >
                {/* Step dot - smaller */}
                <div
                  className={`
                    w-3 h-3 rounded-full border transition-all duration-300
                    ${isCompleted ? 'bg-primary border-blue-600' : ''}
                    ${isCurrent ? 'bg-primary-dark border-blue-500 ring-2 ring-blue-500 ring-opacity-30' : ''}
                    ${isUpcoming ? 'bg-surface-elevated border-gray-600' : ''}
                  `}
                  title={`Step ${step}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile-friendly step list (hidden on desktop) - more compact */}
      <div className="mt-2 lg:hidden" role="list" aria-label="Tutorial steps">
        <div className="flex flex-wrap gap-1">
          {steps.map((step) => {
            const isCompleted = step < current;
            const isCurrent = step === current;

            return (
              <div
                key={step}
                role="listitem"
                aria-label={`Step ${step}${isCompleted ? ', completed' : isCurrent ? ', current' : ', upcoming'}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`
                  px-1.5 py-0.5 rounded text-xs font-medium transition-colors
                  ${isCompleted ? 'bg-primary text-white' : ''}
                  ${isCurrent ? 'bg-primary-dark text-white ring-1 ring-blue-400' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-surface-elevated text-secondary' : ''}
                `}
              >
                {step}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;
