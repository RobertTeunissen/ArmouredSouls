/**
 * useBattleReadiness hook
 * Validates whether a player is ready to complete the onboarding tutorial
 * by checking robot existence, weapon equipment, and credit reserves.
 *
 * Requirements: 23.4, 23.5, 23.6
 */

import { useMemo } from 'react';
import type { Robot } from '../utils/robotApi';

export const BATTLE_READINESS_CREDIT_THRESHOLD = 100_000;

export interface BattleReadinessIssue {
  message: string;
  action: string;
  link: string;
}

export interface BattleReadinessResult {
  isReady: boolean;
  issues: BattleReadinessIssue[];
}

export function useBattleReadiness(robots: Robot[], credits: number): BattleReadinessResult {
  return useMemo(() => {
    const issues: BattleReadinessIssue[] = [];

    if (robots.length === 0) {
      issues.push({
        message: 'Create at least one robot',
        action: 'Go to Robots page',
        link: '/robots',
      });
    }

    const hasWeaponEquipped = robots.some((r) => r.mainWeapon != null);
    if (robots.length > 0 && !hasWeaponEquipped) {
      issues.push({
        message: 'Equip a weapon on at least one robot',
        action: 'Go to Robots page',
        link: '/robots',
      });
    }

    if (credits < BATTLE_READINESS_CREDIT_THRESHOLD) {
      issues.push({
        message: 'Maintain at least ₡100,000 in credits for repairs',
        action: 'Go to Dashboard',
        link: '/dashboard',
      });
    }

    return { isReady: issues.length === 0, issues };
  }, [robots, credits]);
}
