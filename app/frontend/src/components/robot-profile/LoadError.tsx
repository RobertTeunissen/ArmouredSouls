interface LoadErrorProps {
  message: string;
  /** Shown as a Retry button when the caller can request the data again. */
  onRetry?: () => void;
}

/** A failed request on the robot profile: the message plus Retry. */
export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3" role="alert">
      <p className="text-sm text-error">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-[44px] rounded-md bg-surface-elevated px-3 text-sm text-primary hover:bg-white/10">
          Retry
        </button>
      )}
    </div>
  );
}

export default LoadError;
