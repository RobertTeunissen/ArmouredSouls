/**
 * Shared constants for Practice Arena components.
 *
 * Extracted from PracticeArenaPage.tsx during component splitting (Spec 18).
 */

import type { BotTier, LoadoutType, RangeBand, Stance, SparringConfig } from './types';

export const BOT_TIER_DISPLAY: Record<BotTier, { name: string; emoji: string; color: string }> = {
  WimpBot: { name: 'WimpBot', emoji: '🤖', color: 'border-gray-500 bg-gray-800' },
  AverageBot: { name: 'AverageBot', emoji: '⚔️', color: 'border-blue-500 bg-blue-900/30' },
  ExpertBot: { name: 'ExpertBot', emoji: '🛡️', color: 'border-purple-500 bg-purple-900/30' },
  UltimateBot: { name: 'UltimateBot', emoji: '👑', color: 'border-yellow-500 bg-yellow-900/30' },
};

export const LOADOUT_OPTIONS: { value: LoadoutType; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'weapon_shield', label: 'Weapon & Shield' },
  { value: 'two_handed', label: 'Two-Handed' },
  { value: 'dual_wield', label: 'Dual Wield' },
];

export const RANGE_OPTIONS: { value: RangeBand; label: string }[] = [
  { value: 'melee', label: 'Melee' },
  { value: 'short', label: 'Short' },
  { value: 'mid', label: 'Mid' },
  { value: 'long', label: 'Long' },
];

export const STANCE_OPTIONS: { value: Stance; label: string; emoji: string }[] = [
  { value: 'offensive', label: 'Offensive', emoji: '⚡' },
  { value: 'defensive', label: 'Defensive', emoji: '🛡️' },
  { value: 'balanced', label: 'Balanced', emoji: '⚖️' },
];

export const DEFAULT_SPARRING: SparringConfig = {
  botTier: 'AverageBot',
  loadoutType: 'single',
  rangeBand: 'melee',
  stance: 'balanced',
  yieldThreshold: 10,
};
