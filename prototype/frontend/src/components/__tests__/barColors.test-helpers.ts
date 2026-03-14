import { vi } from 'vitest';

/**
 * Shared helpers for HP/Shield bar color property-based tests.
 * Feature: robot-detail-page-visual-enhancement (Requirement 6.6)
 */

export const mockOnRobotUpdate = vi.fn();
export const mockOnEquipWeapon = vi.fn();
export const mockOnUnequipWeapon = vi.fn();

export function createRobot(currentHP: number, maxHP: number, currentShield: number, maxShield: number) {
  return {
    id: 1,
    name: 'Test Robot',
    currentHP,
    maxHP,
    currentShield,
    maxShield,
    battleReadiness: 100,
    repairCost: 0,
    loadoutType: 'single',
    mainWeaponId: null,
    offhandWeaponId: null,
    stance: 'balanced',
    yieldThreshold: 50,
    mainWeapon: null,
    offhandWeapon: null,
  };
}

export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// Color constants
export const GREEN = '#3fb950';   // rgb(63, 185, 80)
export const AMBER = '#d29922';   // rgb(210, 153, 34)
export const RED = '#f85149';     // rgb(248, 81, 73)

export function isColor(backgroundColor: string, hex: string): boolean {
  return backgroundColor === hexToRgb(hex) || backgroundColor === hex;
}
