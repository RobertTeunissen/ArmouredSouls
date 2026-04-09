/**
 * FacilityCard — Renders a single facility with level, benefits, and upgrade controls.
 *
 * Extracted from FacilitiesPage.tsx during component splitting (Spec 18).
 */

import FacilityIcon from '../FacilityIcon';
import type { Facility } from './types';

export interface FacilityCardProps {
  facility: Facility;
  currency: number;
  userPrestige: number;
  upgrading: string | null;
  onUpgrade: (facilityType: string) => void;
  facilityRef: (el: HTMLDivElement | null) => void;
}

export function FacilityCard({ facility, currency, userPrestige, upgrading, onUpgrade, facilityRef }: FacilityCardProps) {
  return (
    <div
      ref={facilityRef}
      id={`facility-${facility.type}`}
      className={`bg-surface p-6 rounded-lg relative transition-all duration-300 ${
        facility.implemented
          ? 'border border-green-700/30'
          : 'border border-yellow-600/50 opacity-90'
      }`}
    >
      {/* Implementation Status Badge */}
      {!facility.implemented && (
        <div className="absolute top-4 right-4">
          <span className="text-xs px-2 py-1 rounded bg-yellow-600 text-yellow-100">
            ⚠ Coming Soon
          </span>
        </div>
      )}

      <div className="flex items-start mb-4">
        <div className="mr-4 mt-1 flex-shrink-0">
          <FacilityIcon
            facilityType={facility.type}
            facilityName={facility.name}
            size="medium"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-2xl font-semibold mb-2">{facility.name}</h3>
          <p className="text-secondary text-sm">{facility.description}</p>
        </div>
      </div>

      {/* Level Display with Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-secondary">Level Progress</span>
          <span className="text-lg font-bold">
            {facility.currentLevel}/{facility.maxLevel}
          </span>
        </div>
        <div className="w-full bg-surface-elevated rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${(facility.currentLevel / facility.maxLevel) * 100}%` }}
          />
        </div>
      </div>

      {facility.currentLevel > 0 && (
        <div className="mb-4 p-3 bg-surface-elevated rounded">
          <div className="text-sm text-secondary mb-1">Current Benefit:</div>
          <div className="text-success">
            {facility.currentBenefit || facility.benefits[facility.currentLevel - 1]}
          </div>
          {facility.currentOperatingCost !== undefined && facility.currentOperatingCost > 0 && (
            <div className="text-xs text-secondary mt-2">
              Operating Cost: <span className="text-error">₡{facility.currentOperatingCost.toLocaleString()}/day</span>
            </div>
          )}
        </div>
      )}

      {facility.canUpgrade && facility.implemented && (
        <>
          <div className="mb-4 p-3 bg-surface-elevated/50 rounded border border-gray-600">
            <div className="text-sm text-secondary mb-1">Next Level Benefit:</div>
            <div className="text-primary">
              {facility.nextBenefit || facility.benefits[facility.currentLevel]}
            </div>
            {facility.nextOperatingCost !== undefined && facility.nextOperatingCost > 0 && (
              <div className="text-xs text-secondary mt-2">
                Operating Cost: <span className="text-error">₡{facility.nextOperatingCost.toLocaleString()}/day</span>
                {facility.currentOperatingCost !== undefined && facility.currentOperatingCost > 0 && (
                  <span className="text-warning ml-2">
                    (+₡{(facility.nextOperatingCost - facility.currentOperatingCost).toLocaleString()}/day)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Prestige Requirement Display */}
          {!!(facility.nextLevelPrestigeRequired && facility.nextLevelPrestigeRequired > 0) && (
            <div className={`mb-4 p-3 rounded border ${
              facility.hasPrestige
                ? 'bg-green-900/20 border-green-700/50'
                : 'bg-red-900/20 border-red-700/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-secondary">Prestige Required: </span>
                  <span className={facility.hasPrestige ? 'text-success' : 'text-error'}>
                    {facility.nextLevelPrestigeRequired.toLocaleString()}
                  </span>
                </div>
                <span className="text-xl">
                  {facility.hasPrestige ? '✓' : '🔒'}
                </span>
              </div>
              {!facility.hasPrestige && (
                <div className="text-xs text-secondary mt-1">
                  Current: {userPrestige.toLocaleString()} prestige
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="text-lg">
              Cost: <span className="text-success font-semibold">
                ₡{facility.upgradeCost.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => onUpgrade(facility.type)}
              disabled={
                upgrading !== null ||
                (currency < facility.upgradeCost) ||
                !!(facility.nextLevelPrestigeRequired && !facility.hasPrestige)
              }
              className="bg-primary hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded transition-colors"
              title={
                facility.nextLevelPrestigeRequired && !facility.hasPrestige
                  ? `Requires ${facility.nextLevelPrestigeRequired.toLocaleString()} prestige`
                  : undefined
              }
            >
              {upgrading === facility.type ? 'Upgrading...' : 'Upgrade'}
            </button>
          </div>

          {currency < facility.upgradeCost && (
            <div className="mt-2 text-sm text-error">
              Insufficient credits
            </div>
          )}
          {!!(facility.nextLevelPrestigeRequired && !facility.hasPrestige) && (
            <div className="mt-2 text-sm text-error">
              Insufficient prestige (need {facility.nextLevelPrestigeRequired.toLocaleString()})
            </div>
          )}
        </>
      )}

      {facility.canUpgrade && !facility.implemented && (
        <div className="text-center py-3 bg-surface-elevated/50 rounded border border-yellow-600/50">
          <span className="text-warning font-semibold">Coming Soon</span>
        </div>
      )}

      {!facility.canUpgrade && (
        <div className="text-center py-3 bg-surface-elevated rounded">
          <span className="text-success font-semibold">Maximum Level Reached</span>
        </div>
      )}
    </div>
  );
}
