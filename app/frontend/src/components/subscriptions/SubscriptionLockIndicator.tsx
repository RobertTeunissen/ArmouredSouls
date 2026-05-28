/**
 * SubscriptionLockIndicator Component
 *
 * Renders a lock icon with tooltip showing the queued battle cycle
 * when a robot's subscription is locked due to a scheduled battle.
 * Renders nothing when not locked.
 *
 * Requirements: R9.4
 */

import { useState } from 'react';

interface SubscriptionLockIndicatorProps {
  /** Whether the subscription is currently locked */
  isLocked: boolean;
  /** The cycle number of the scheduled battle (shown in tooltip) */
  scheduledCycle?: number;
}

function SubscriptionLockIndicator({ isLocked, scheduledCycle }: SubscriptionLockIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isLocked) {
    return null;
  }

  const tooltipText = scheduledCycle
    ? `Locked — queued battle in cycle ${scheduledCycle}`
    : 'Locked — queued battle';

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="img"
      aria-label={tooltipText}
    >
      {/* Lock icon (SVG) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-4 h-4 text-amber-400"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
          clipRule="evenodd"
        />
      </svg>

      {/* Tooltip */}
      {showTooltip && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 border border-white/10 rounded shadow-lg whitespace-nowrap z-50"
          role="tooltip"
        >
          {tooltipText}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </span>
      )}
    </span>
  );
}

export default SubscriptionLockIndicator;
