interface StatusBarProps {
  credits: number;
  upgradeCost: number;
  tuningUsed: number;
  tuningPool: number | null;
  tuningChanged: boolean;
  hasChanges: boolean;
  saving: boolean;
  hasNext: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onNext: () => void;
}

/**
 * Pinned to the bottom (above the mobile tab bar): what the plan costs and
 * what is left, with Save. "Save · next robot" moves straight on.
 */
export function StatusBar({ credits, upgradeCost, tuningUsed, tuningPool, tuningChanged, hasChanges, saving, hasNext, onDiscard, onSave, onNext }: StatusBarProps) {
  const after = credits - upgradeCost;
  const short = after < 0;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-white/10 bg-surface/95 backdrop-blur lg:bottom-0" role="region" aria-label="Plan summary">
      <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <dl className="flex flex-1 flex-wrap gap-x-6 gap-y-1">
          <Figure label="Credits" value={`₡${credits.toLocaleString()}`} className="text-primary" />
          <Figure label="Upgrades" value={upgradeCost > 0 ? `₡${upgradeCost.toLocaleString()}` : '—'} />
          <Figure label="Tuning" value={tuningPool === null ? '—' : `${tuningUsed} / ${tuningPool}${tuningChanged ? ' · changed' : ''}`} />
          <Figure label="After" value={`₡${after.toLocaleString()}`} className={short ? 'text-error' : 'text-success'} />
        </dl>
        {short && <p className="w-full text-xs text-error lg:w-auto" role="alert">Not enough credits for this plan.</p>}
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onDiscard}
            disabled={!hasChanges || saving}
            className="min-h-[44px] flex-1 rounded-lg bg-surface-elevated px-4 text-sm text-secondary hover:text-white disabled:opacity-40 sm:flex-none"
          >
            Discard
          </button>
          {/* Keep "Saving…" up for the whole save: the plan clears before the tuning write finishes. */}
          {hasChanges || saving ? (
            <button
              type="button"
              onClick={onSave}
              disabled={saving || short}
              className="min-h-[44px] flex-[2] rounded-lg bg-primary px-5 text-sm font-semibold text-background hover:bg-primary-light disabled:opacity-50 sm:flex-none"
            >
              {saving ? 'Saving…' : hasNext ? 'Save · next robot ▶' : 'Save'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext || saving}
              className="min-h-[44px] flex-[2] rounded-lg bg-surface-elevated px-5 text-sm text-white hover:bg-white/10 disabled:opacity-40 sm:flex-none"
            >
              Next robot ▶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, className = 'text-white' }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-secondary">{label}</dt>
      <dd className={`text-base font-bold tabular-nums sm:text-lg ${className}`}>{value}</dd>
    </div>
  );
}

