/**
 * BookingOfficeUpgradePanel — upgrade control plus Upgrade_Implication_Panel
 * for the Booking Office, rendered on the Booking Office page.
 *
 * Spec #46 Requirement 6: the page told players to "upgrade the facility to
 * unlock more slots per robot" but offered no control, forcing a trip to the
 * Facilities page. This puts the action where the limit is discovered, and
 * states the cost and the effect before the player commits.
 *
 * Every figure comes from `GET /api/facilities` rather than being recomputed
 * here (R6.14), and the mutation goes through the existing upgrade endpoint so
 * its `lockUserForSpending` transaction and prestige validation are inherited
 * unchanged (R6.6). The disabled states below are a usability affordance, not
 * the security boundary.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';

/** Base subscriptions every robot holds before any Booking Office level. */
const BASE_SUBSCRIPTIONS = 3;

interface FacilityEntry {
  type: string;
  name: string;
  currentLevel: number;
  maxLevel: number;
  upgradeCost: number;
  canUpgrade: boolean;
  nextLevelPrestigeRequired: number;
  hasPrestige: boolean;
  canAfford: boolean;
  currentOperatingCost: number;
  nextOperatingCost: number;
}

interface FacilitiesResponse {
  facilities: FacilityEntry[];
  userPrestige: number;
  userCurrency: number;
}

export interface BookingOfficeUpgradePanelProps {
  /** Called after a successful upgrade so the page can refresh level and matrix. */
  onUpgraded: () => void;
}

export function BookingOfficeUpgradePanel({ onUpgraded }: BookingOfficeUpgradePanelProps) {
  const [facility, setFacility] = useState<FacilityEntry | null>(null);
  const [currency, setCurrency] = useState(0);
  const [prestige, setPrestige] = useState(0);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFacility = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<FacilitiesResponse>('/api/facilities');
      const entry = data.facilities?.find((f) => f.type === 'booking_office') ?? null;
      setFacility(entry);
      setCurrency(data.userCurrency ?? 0);
      setPrestige(data.userPrestige ?? 0);
    } catch {
      setFacility(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacility();
  }, [fetchFacility]);

  const handleUpgrade = async () => {
    if (upgrading) return;
    setUpgrading(true);
    setError(null);
    try {
      await api.post('/api/facilities/upgrade', { facilityType: 'booking_office' });
      // Refresh our own figures and let the page refresh the level and matrix,
      // so the new subscription slots become usable without a reload (R6.15)
      await fetchFacility();
      onUpgraded();
    } catch (err: unknown) {
      // Surface the endpoint's own message so a prestige or credit rejection
      // reads the same here as on the Facilities page (R6.17)
      setError((err instanceof ApiError && err.message) || 'Upgrade failed. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  if (loading || !facility) return null;

  const atMaxLevel = !facility.canUpgrade || facility.currentLevel >= facility.maxLevel;

  // Maximum level: replace the control with an indicator and omit the panel (R6.13)
  if (atMaxLevel) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <span aria-hidden="true">✅</span>
          <span className="text-secondary">
            Booking Office is at maximum level — {BASE_SUBSCRIPTIONS + facility.maxLevel} subscriptions per robot.
          </span>
        </div>
      </div>
    );
  }

  const nextLevel = facility.currentLevel + 1;
  const nextCap = BASE_SUBSCRIPTIONS + nextLevel;
  const gatedOnPrestige = !facility.hasPrestige;
  const gatedOnCredits = !facility.canAfford;
  const blocked = gatedOnPrestige || gatedOnCredits;

  // State both blocking conditions rather than only the first (R6.12)
  const reasons: string[] = [];
  if (gatedOnCredits) {
    reasons.push(
      `You need ₡${facility.upgradeCost.toLocaleString()} and have ₡${currency.toLocaleString()}`,
    );
  }
  if (gatedOnPrestige) {
    reasons.push(
      `Level ${nextLevel} requires ${facility.nextLevelPrestigeRequired.toLocaleString()} prestige and you have ${prestige.toLocaleString()}`,
    );
  }
  const disabledReason = reasons.join('. ');

  return (
    <div className="bg-surface rounded-lg border border-white/10 p-4 mb-6">
      <h3 className="text-sm font-semibold mb-3">Upgrade to Level {nextLevel}</h3>

      {/* Implication panel — stacks vertically below lg, row from lg up (R6.22) */}
      <dl className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-8 mb-4 text-sm">
        <div>
          <dt className="text-secondary text-xs uppercase tracking-wide">Cost</dt>
          <dd className="font-semibold">₡{facility.upgradeCost.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-secondary text-xs uppercase tracking-wide">Subscriptions per robot</dt>
          <dd className="font-semibold">
            {BASE_SUBSCRIPTIONS + facility.currentLevel} → <span className="text-primary">{nextCap}</span>
          </dd>
        </div>
        <div>
          <dt className="text-secondary text-xs uppercase tracking-wide">Daily operating cost</dt>
          <dd className="font-semibold">
            ₡{facility.currentOperatingCost.toLocaleString()} → ₡{facility.nextOperatingCost.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-secondary text-xs uppercase tracking-wide">Your balance</dt>
          <dd className="font-semibold">₡{currency.toLocaleString()}</dd>
        </div>
        {facility.nextLevelPrestigeRequired > 0 && (
          <div>
            <dt className="text-secondary text-xs uppercase tracking-wide">Prestige required</dt>
            <dd className="font-semibold">
              {facility.nextLevelPrestigeRequired.toLocaleString()}{' '}
              <span className="text-secondary text-xs">(you have {prestige.toLocaleString()})</span>
            </dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        onClick={handleUpgrade}
        disabled={blocked || upgrading}
        aria-describedby={blocked ? 'booking-office-upgrade-reason' : undefined}
        className="w-full lg:w-auto min-h-[44px] px-4 py-2 rounded-md font-medium transition-colors bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {upgrading
          ? 'Upgrading…'
          : `Upgrade Booking Office to Level ${nextLevel} — ₡${facility.upgradeCost.toLocaleString()}`}
      </button>

      {/* Disabled reason as text, not colour alone, and associated with the control (R6.20) */}
      {blocked && (
        <p id="booking-office-upgrade-reason" className="mt-2 text-xs text-warning">
          {disabledReason}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export default BookingOfficeUpgradePanel;
