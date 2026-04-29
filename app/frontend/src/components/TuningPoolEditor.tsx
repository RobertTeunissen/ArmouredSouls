import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../utils/apiClient';
import ConfirmationModal from './ConfirmationModal';
import Toast from './Toast';
import type { RobotWithAttributes } from '../types/robot';

// ── Types ──────────────────────────────────────────────────────────────────

interface TuningPoolEditorProps {
  robotId: number;
  robot: RobotWithAttributes;
}

interface TuningAllocationState {
  robotId: number;
  facilityLevel: number;
  poolSize: number;
  allocated: number;
  remaining: number;
  perAttributeMaxes: Record<string, number>;
  allocations: Record<string, number>;
}

// ── Category definitions (shared with UpgradePlanner / EffectiveStatsDisplay) ──

const categoryColors: Record<string, { bg: string; text: string; icon: string }> = {
  'Combat Systems': { bg: 'bg-red-900/30', text: 'text-error', icon: '⚔️' },
  'Defensive Systems': { bg: 'bg-blue-900/30', text: 'text-primary', icon: '🛡️' },
  'Chassis & Mobility': { bg: 'bg-green-900/30', text: 'text-success', icon: '⚙️' },
  'AI Processing': { bg: 'bg-yellow-900/30', text: 'text-warning', icon: '🧠' },
  'Team Coordination': { bg: 'bg-purple-900/30', text: 'text-purple-400', icon: '🤝' },
};

const attributeCategories: Record<string, { attributes: { key: string; label: string; icon: string }[] }> = {
  'Combat Systems': {
    attributes: [
      { key: 'combatPower', label: 'Combat Power', icon: '💥' },
      { key: 'targetingSystems', label: 'Targeting Systems', icon: '🎯' },
      { key: 'criticalSystems', label: 'Critical Systems', icon: '💢' },
      { key: 'penetration', label: 'Penetration', icon: '🔪' },
      { key: 'weaponControl', label: 'Weapon Control', icon: '🎮' },
      { key: 'attackSpeed', label: 'Attack Speed', icon: '⚡' },
    ],
  },
  'Defensive Systems': {
    attributes: [
      { key: 'armorPlating', label: 'Armor Plating', icon: '🛡️' },
      { key: 'shieldCapacity', label: 'Shield Capacity', icon: '✨' },
      { key: 'evasionThrusters', label: 'Evasion Thrusters', icon: '💨' },
      { key: 'damageDampeners', label: 'Damage Dampeners', icon: '🔇' },
      { key: 'counterProtocols', label: 'Counter Protocols', icon: '↩️' },
    ],
  },
  'Chassis & Mobility': {
    attributes: [
      { key: 'hullIntegrity', label: 'Hull Integrity', icon: '🏗️' },
      { key: 'servoMotors', label: 'Servo Motors', icon: '⚙️' },
      { key: 'gyroStabilizers', label: 'Gyro Stabilizers', icon: '🔄' },
      { key: 'hydraulicSystems', label: 'Hydraulic Systems', icon: '💧' },
      { key: 'powerCore', label: 'Power Core', icon: '🔋' },
    ],
  },
  'AI Processing': {
    attributes: [
      { key: 'combatAlgorithms', label: 'Combat Algorithms', icon: '🧮' },
      { key: 'threatAnalysis', label: 'Threat Analysis', icon: '🔍' },
      { key: 'adaptiveAI', label: 'Adaptive AI', icon: '🤖' },
      { key: 'logicCores', label: 'Logic Cores', icon: '💻' },
    ],
  },
  'Team Coordination': {
    attributes: [
      { key: 'syncProtocols', label: 'Sync Protocols', icon: '🔗' },
      { key: 'supportSystems', label: 'Support Systems', icon: '🆘' },
      { key: 'formationTactics', label: 'Formation Tactics', icon: '📐' },
    ],
  },
};

// ── Component ──────────────────────────────────────────────────────────────

function TuningPoolEditor({ robotId, robot }: TuningPoolEditorProps) {
  const [tuningState, setTuningState] = useState<TuningAllocationState | null>(null);
  const [localAllocations, setLocalAllocations] = useState<Record<string, number>>({});
  const [savedAllocations, setSavedAllocations] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Fetch tuning allocation state on mount
  const fetchTuningState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<TuningAllocationState>(
        `/api/robots/${robotId}/tuning-allocation`
      );
      const state = response.data;
      setTuningState(state);
      setLocalAllocations({ ...state.allocations });
      setSavedAllocations({ ...state.allocations });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tuning allocation';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [robotId]);

  useEffect(() => {
    fetchTuningState();
  }, [fetchTuningState]);

  // Derived values
  const totalAllocated = useMemo(() => {
    return Object.values(localAllocations).reduce((sum, val) => sum + val, 0);
  }, [localAllocations]);

  const poolSize = tuningState?.poolSize ?? 0;
  const remaining = poolSize - totalAllocated;

  const hasChanges = useMemo(() => {
    const allKeys = new Set([
      ...Object.keys(localAllocations),
      ...Object.keys(savedAllocations),
    ]);
    for (const key of allKeys) {
      if ((localAllocations[key] ?? 0) !== (savedAllocations[key] ?? 0)) {
        return true;
      }
    }
    return false;
  }, [localAllocations, savedAllocations]);

  const hasAnyAllocations = useMemo(() => {
    return Object.values(localAllocations).some((v) => v > 0);
  }, [localAllocations]);

  // Budget bar color — filling up is good, so teal throughout.
  // Only warn when over-budget (shouldn't happen with stepper guards, but defensive).
  const budgetBarColor = useMemo(() => {
    if (poolSize === 0) return 'bg-teal-500';
    if (totalAllocated > poolSize) return 'bg-red-500';
    return 'bg-teal-500';
  }, [totalAllocated, poolSize]);

  const budgetPercent = poolSize > 0 ? Math.min((totalAllocated / poolSize) * 100, 100) : 0;

  // Handle increment for an attribute
  const handleIncrement = useCallback(
    (attrKey: string) => {
      const perAttrMax = tuningState?.perAttributeMaxes[attrKey] ?? 0;
      const current = localAllocations[attrKey] ?? 0;

      // Can't exceed per-attribute max
      if (current >= perAttrMax) return;
      // Can't exceed budget
      if (remaining <= 0) return;

      setLocalAllocations((prev) => ({
        ...prev,
        [attrKey]: current + 1,
      }));
    },
    [localAllocations, remaining, tuningState]
  );

  // Handle decrement for an attribute
  const handleDecrement = useCallback(
    (attrKey: string) => {
      const current = localAllocations[attrKey] ?? 0;
      if (current <= 0) return;

      setLocalAllocations((prev) => {
        const next = { ...prev };
        if (current - 1 === 0) {
          delete next[attrKey];
        } else {
          next[attrKey] = current - 1;
        }
        return next;
      });
    },
    [localAllocations]
  );

  // Save tuning allocation
  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    try {
      const response = await apiClient.put<TuningAllocationState>(
        `/api/robots/${robotId}/tuning-allocation`,
        localAllocations
      );
      const state = response.data;
      setTuningState(state);
      setLocalAllocations({ ...state.allocations });
      setSavedAllocations({ ...state.allocations });
      setToast({ message: 'Tuning allocation saved', type: 'success' });
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to save tuning allocation'
          : 'Failed to save tuning allocation';
      setToast({ message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset all allocations to 0
  const handleResetAll = () => {
    if (hasAnyAllocations) {
      setShowResetConfirm(true);
    }
  };

  const confirmReset = () => {
    setLocalAllocations({});
    setShowResetConfirm(false);
  };

  // Next pool size for upsell
  const nextLevelPoolSize = tuningState ? (tuningState.facilityLevel + 2) * 10 : null;

  // ── Loading / Error states ──

  if (loading) {
    return (
      <div className="bg-surface p-4 rounded-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          <span className="ml-3 text-secondary">Loading tuning allocation…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface p-4 rounded-lg">
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded">
          <p className="font-semibold">Failed to load tuning data</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchTuningState}
            className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!tuningState) return null;

  // Max attributes in any category (for spacer alignment in grid)
  const maxAttributes = 6;

  // ── Render ──

  return (
    <div className="bg-surface p-4 rounded-lg">
      {/* Header */}
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        ⚙️ Tuning Pool
      </h2>

      {/* Budget Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1 text-sm">
          <span className="text-secondary">
            <span className="text-teal-400 font-semibold">{totalAllocated}</span>
            {' / '}
            {poolSize} allocated
          </span>
          <span className="text-secondary">
            {remaining} remaining
          </span>
        </div>
        <div className="w-full bg-teal-900/20 rounded-full h-3 overflow-hidden">
          <div
            className={`${budgetBarColor} h-3 rounded-full transition-all duration-200`}
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between mb-4">
        <button
          onClick={handleResetAll}
          disabled={!hasAnyAllocations}
          className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
            hasAnyAllocations
              ? 'bg-surface-elevated hover:bg-gray-600 text-white cursor-pointer'
              : 'bg-surface text-gray-600 cursor-not-allowed'
          }`}
        >
          Reset All
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
            hasChanges && !isSaving
              ? 'bg-teal-500 hover:bg-teal-600 text-white cursor-pointer'
              : 'bg-surface-elevated text-tertiary cursor-not-allowed'
          }`}
        >
          {isSaving ? 'Saving…' : 'Save Tuning'}
        </button>
      </div>

      {/* Attribute Steppers by Category — 3-column grid on wide screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.entries(attributeCategories).map(([category, config]) => {
          const colors = categoryColors[category];

          // Category-level totals
          const categoryAllocated = config.attributes.reduce(
            (sum, { key }) => sum + (localAllocations[key] ?? 0),
            0
          );

          return (
            <div key={category} className="space-y-2">
              {/* Category Header */}
              <div className={`${colors.bg} ${colors.text} px-3 py-2 rounded-lg`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{colors.icon}</span>
                  <span className="font-semibold text-sm">{category}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary">
                    {config.attributes.length} attributes
                  </span>
                  {categoryAllocated > 0 && (
                    <span className="text-teal-400 font-semibold">
                      +{categoryAllocated} tuned
                    </span>
                  )}
                </div>
              </div>

              {/* Attribute Stepper Rows */}
              <div className="space-y-2">
                {config.attributes.map(({ key, label, icon }) => {
                  const baseValue = Math.floor(Number(robot[key]) || 0);
                  const allocation = localAllocations[key] ?? 0;
                  const perAttrMax = tuningState.perAttributeMaxes[key] ?? 0;
                  const effectiveValue = baseValue + allocation;
                  const isAtMax = allocation >= perAttrMax;
                  const isDisabled = perAttrMax === 0;
                  const canIncrement = !isAtMax && !isDisabled && remaining > 0;
                  const canDecrement = allocation > 0;

                  return (
                    <div
                      key={key}
                      className={`
                        h-[42px] px-3 py-2 rounded flex items-center justify-between gap-3
                        transition-colors
                        ${allocation > 0
                          ? 'bg-teal-900/30 border border-teal-500'
                          : 'bg-surface/50 hover:bg-gray-750'
                        }
                        ${isDisabled ? 'opacity-50' : ''}
                      `}
                    >
                      {/* Left: Attribute Info */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-base">{icon}</span>
                        <div className="flex flex-col min-w-0">
                          <div className="text-secondary text-xs font-medium truncate">{label}</div>
                          <div className="text-xs text-tertiary">
                            base {baseValue}{perAttrMax > 0 ? ` / max +${perAttrMax}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Right: Stepper Controls */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Decrement Button */}
                        <button
                          onClick={() => handleDecrement(key)}
                          disabled={!canDecrement}
                          className={`
                            w-6 h-6 rounded flex items-center justify-center font-bold text-sm
                            transition-colors
                            ${canDecrement
                              ? 'bg-surface-elevated hover:bg-gray-600 text-white cursor-pointer'
                              : 'bg-surface text-gray-600 cursor-not-allowed'
                            }
                          `}
                          aria-label={`Decrease tuning for ${label}`}
                        >
                          −
                        </button>

                        {/* Allocation Display */}
                        <div className="w-12 text-center">
                          {allocation > 0 ? (
                            <span className="text-teal-400 font-bold text-sm">+{allocation}</span>
                          ) : (
                            <span className="text-gray-600 text-sm">0</span>
                          )}
                        </div>

                        {/* Increment Button */}
                        <button
                          onClick={() => handleIncrement(key)}
                          disabled={!canIncrement}
                          className={`
                            w-6 h-6 rounded flex items-center justify-center font-bold text-sm
                            transition-colors
                            ${canIncrement
                              ? 'bg-teal-500 hover:bg-teal-600 text-white cursor-pointer'
                              : 'bg-surface text-gray-600 cursor-not-allowed'
                            }
                          `}
                          aria-label={`Increase tuning for ${label}`}
                          title={isAtMax ? `At max (+${perAttrMax})` : isDisabled ? 'No tuning available' : `Tune ${label}`}
                        >
                          +
                        </button>

                        {/* Effective Value Preview */}
                        <div className="w-14 text-right">
                          {allocation > 0 ? (
                            <span className="text-teal-400 font-semibold text-xs">
                              → {effectiveValue}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Spacers for grid alignment */}
                {Array.from({ length: maxAttributes - config.attributes.length }).map((_, i) => (
                  <div key={`spacer-${i}`} className="h-[42px]" />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upsell Section */}
      {poolSize < 110 && nextLevelPoolSize && (
        <div className="mt-6 bg-teal-900/20 border border-teal-700/30 rounded-lg px-4 py-3">
          <p className="text-sm text-secondary">
            💡 Current pool: <span className="text-teal-400 font-semibold">{poolSize}</span> points.
            {tuningState.facilityLevel === 0 ? (
              <>
                {' '}Build a Tuning Bay to unlock{' '}
                <span className="text-teal-400 font-semibold">{nextLevelPoolSize}</span> points per robot.
              </>
            ) : (
              <>
                {' '}Upgrade your Tuning Bay to get{' '}
                <span className="text-teal-400 font-semibold">{nextLevelPoolSize}</span> points per robot.
              </>
            )}
            {' '}
            <a
              href="/facilities"
              className="text-teal-400 hover:text-teal-300 underline"
            >
              View Facilities →
            </a>
          </p>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <ConfirmationModal
          title="Reset All Tuning"
          message="Are you sure you want to clear all tuning allocations? This will set all values to 0. You'll need to save to persist the change."
          confirmLabel="Reset All"
          cancelLabel="Cancel"
          isDestructive={true}
          onConfirm={confirmReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default TuningPoolEditor;
