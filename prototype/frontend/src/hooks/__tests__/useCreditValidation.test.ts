/**
 * useCreditValidation hook tests
 * Tests credit validation logic for purchase flows during onboarding.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCreditValidation, CREDIT_THRESHOLDS } from '../useCreditValidation';

describe('useCreditValidation', () => {
  it('should return canAfford true when credits >= cost', () => {
    const { result } = renderHook(() => useCreditValidation(100000, 50000));
    expect(result.current.canAfford).toBe(true);
  });

  it('should return canAfford true when credits exactly equal cost', () => {
    const { result } = renderHook(() => useCreditValidation(50000, 50000));
    expect(result.current.canAfford).toBe(true);
  });

  it('should return canAfford false when credits < cost', () => {
    const { result } = renderHook(() => useCreditValidation(30000, 50000));
    expect(result.current.canAfford).toBe(false);
  });

  it('should return isLowReserve true when remaining < 50,000', () => {
    const { result } = renderHook(() => useCreditValidation(80000, 40000));
    // remaining = 40000, which is < 50000
    expect(result.current.isLowReserve).toBe(true);
  });

  it('should return isLowReserve false when remaining >= 50,000', () => {
    const { result } = renderHook(() => useCreditValidation(200000, 100000));
    // remaining = 100000, which is >= 50000
    expect(result.current.isLowReserve).toBe(false);
  });

  it('should return isLowReserve true at exact threshold boundary', () => {
    const { result } = renderHook(() => useCreditValidation(99999, 50000));
    // remaining = 49999, which is < 50000
    expect(result.current.isLowReserve).toBe(true);
  });

  it('should return isLowReserve false at exact threshold', () => {
    const { result } = renderHook(() => useCreditValidation(100000, 50000));
    // remaining = 50000, which is NOT < 50000
    expect(result.current.isLowReserve).toBe(false);
  });

  it('should return isCriticalBudget true when credits < 600,000', () => {
    const { result } = renderHook(() => useCreditValidation(500000, 10000));
    expect(result.current.isCriticalBudget).toBe(true);
  });

  it('should return isCriticalBudget false when credits >= 600,000', () => {
    const { result } = renderHook(() => useCreditValidation(600000, 10000));
    expect(result.current.isCriticalBudget).toBe(false);
  });

  it('should return isCriticalBudget true at boundary (599,999)', () => {
    const { result } = renderHook(() => useCreditValidation(599999, 0));
    expect(result.current.isCriticalBudget).toBe(true);
  });

  it('should calculate remainingAfterPurchase correctly', () => {
    const { result } = renderHook(() => useCreditValidation(1000000, 250000));
    expect(result.current.remainingAfterPurchase).toBe(750000);
  });

  it('should return negative remainingAfterPurchase when cannot afford', () => {
    const { result } = renderHook(() => useCreditValidation(10000, 50000));
    expect(result.current.remainingAfterPurchase).toBe(-40000);
  });

  it('should handle zero credits', () => {
    const { result } = renderHook(() => useCreditValidation(0, 50000));
    expect(result.current.canAfford).toBe(false);
    expect(result.current.isLowReserve).toBe(true);
    expect(result.current.isCriticalBudget).toBe(true);
    expect(result.current.remainingAfterPurchase).toBe(-50000);
  });

  it('should handle zero cost', () => {
    const { result } = renderHook(() => useCreditValidation(1000000, 0));
    expect(result.current.canAfford).toBe(true);
    expect(result.current.isLowReserve).toBe(false);
    expect(result.current.isCriticalBudget).toBe(false);
    expect(result.current.remainingAfterPurchase).toBe(1000000);
  });

  it('should export correct threshold constants', () => {
    expect(CREDIT_THRESHOLDS.LOW_RESERVE).toBe(50000);
    expect(CREDIT_THRESHOLDS.CRITICAL_BUDGET).toBe(600000);
  });
});
