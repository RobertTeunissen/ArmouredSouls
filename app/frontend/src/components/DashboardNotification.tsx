/**
 * DashboardNotification — Unified alert banner for the dashboard notification area.
 *
 * All dashboard notifications use this component to ensure consistent styling,
 * layout, and interaction patterns.
 *
 * Variants:
 *  - success: green accent (promotions, positive events)
 *  - warning: amber accent (readiness issues, caution states)
 *  - danger: red accent (demotions, low balance, critical)
 *  - info: blue accent (informational)
 */

import React from 'react';

type NotificationVariant = 'success' | 'warning' | 'danger' | 'info';

export interface DashboardNotificationProps {
  variant: NotificationVariant;
  icon: string;
  message: React.ReactNode;
  detail?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const VARIANT_STYLES: Record<NotificationVariant, { container: string; text: string; button: string }> = {
  success: {
    container: 'bg-success/10 border-success',
    text: 'text-success',
    button: 'bg-success hover:bg-success/90 text-black',
  },
  warning: {
    container: 'bg-warning/10 border-warning',
    text: 'text-warning',
    button: 'bg-warning hover:bg-warning/90 text-black',
  },
  danger: {
    container: 'bg-error/10 border-error',
    text: 'text-error',
    button: 'bg-error hover:bg-error/90 text-white',
  },
  info: {
    container: 'bg-primary/10 border-primary',
    text: 'text-primary',
    button: 'bg-primary hover:bg-primary/90 text-white',
  },
};

function DashboardNotification({
  variant,
  icon,
  message,
  detail,
  actionLabel,
  onAction,
  onDismiss,
}: DashboardNotificationProps): React.JSX.Element {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`p-4 rounded-lg border-l-4 flex items-center justify-between gap-3 ${styles.container}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-2xl flex-shrink-0" aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <span className={`font-semibold ${styles.text}`}>{message}</span>
          {detail && (
            <span className={`block text-sm ${styles.text} opacity-80 mt-0.5`}>{detail}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className={`px-4 py-2 rounded font-semibold text-sm transition-colors min-h-[44px] ${styles.button}`}
          >
            {actionLabel}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-2 rounded hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary hover:text-white"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default DashboardNotification;
