import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRobotSetupWizard } from '../useRobotSetupWizard';

describe('useRobotSetupWizard', () => {
  const ROBOT_ID = 42;
  const STORAGE_KEY = `robot-setup-${ROBOT_ID}`;

  /** In-memory backing store for localStorage mock */
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => storage[key] ?? null,
    );
    (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, value: string) => { storage[key] = value; },
    );
    (localStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => { delete storage[key]; },
    );
  });

  describe('initial state', () => {
    it('should start at step 1 with empty completed/skipped arrays', () => {
      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      expect(result.current.currentStep).toBe(1);
      expect(result.current.totalSteps).toBe(7);
      expect(result.current.state.completedSteps).toEqual([]);
      expect(result.current.state.skippedSteps).toEqual([]);
      expect(result.current.isComplete).toBe(false);
    });
  });

  describe('resume from localStorage', () => {
    it('should restore state from localStorage on mount', () => {
      const saved = { currentStep: 4, completedSteps: [1, 2], skippedSteps: [3] };
      storage[STORAGE_KEY] = JSON.stringify(saved);

      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      expect(result.current.currentStep).toBe(4);
      expect(result.current.state.completedSteps).toEqual([1, 2]);
      expect(result.current.state.skippedSteps).toEqual([3]);
    });

    it('should fall back to initial state when localStorage contains invalid JSON', () => {
      storage[STORAGE_KEY] = 'not-json';

      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      expect(result.current.currentStep).toBe(1);
      expect(result.current.state.completedSteps).toEqual([]);
      expect(result.current.state.skippedSteps).toEqual([]);
    });

    it('should fall back to initial state when localStorage contains invalid shape', () => {
      storage[STORAGE_KEY] = JSON.stringify([1, 2, 3]);

      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      expect(result.current.currentStep).toBe(1);
    });
  });

  describe('advance()', () => {
    it('should increment currentStep and append to completedSteps', () => {
      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      act(() => { result.current.advance(); });

      expect(result.current.currentStep).toBe(2);
      expect(result.current.state.completedSteps).toEqual([1]);
    });

    it('should persist updated state to localStorage', () => {
      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      act(() => { result.current.advance(); });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.any(String),
      );
      const lastCall = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls
        .filter((call: string[]) => call[0] === STORAGE_KEY)
        .pop();
      const stored = JSON.parse(lastCall![1]);
      expect(stored.currentStep).toBe(2);
      expect(stored.completedSteps).toEqual([1]);
    });
  });

  describe('skipStep()', () => {
    it('should increment currentStep and append to skippedSteps', () => {
      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      act(() => { result.current.skipStep(); });

      expect(result.current.currentStep).toBe(2);
      expect(result.current.state.skippedSteps).toEqual([1]);
      expect(result.current.state.completedSteps).toEqual([]);
    });
  });

  describe('skipAll()', () => {
    it('should call localStorage.removeItem with the correct key', () => {
      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      act(() => { result.current.advance(); });
      act(() => { result.current.skipAll(); });

      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe('reset()', () => {
    it('should remove localStorage entry and reset state to initial', () => {
      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      act(() => { result.current.advance(); });
      act(() => { result.current.advance(); });
      act(() => { result.current.reset(); });

      expect(result.current.currentStep).toBe(1);
      expect(result.current.state.completedSteps).toEqual([]);
      expect(result.current.state.skippedSteps).toEqual([]);
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe('isComplete', () => {
    it('should be true when currentStep exceeds 7', () => {
      const saved = { currentStep: 8, completedSteps: [1, 2, 3, 4, 5, 6, 7], skippedSteps: [] };
      storage[STORAGE_KEY] = JSON.stringify(saved);

      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      expect(result.current.isComplete).toBe(true);
    });

    it('should be false when currentStep is 7 or less', () => {
      const saved = { currentStep: 7, completedSteps: [1, 2, 3, 4, 5, 6], skippedSteps: [] };
      storage[STORAGE_KEY] = JSON.stringify(saved);

      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      expect(result.current.isComplete).toBe(false);
    });
  });

  describe('localStorage unavailable', () => {
    it('should function without persistence when localStorage throws', () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('SecurityError: localStorage not available');
      });
      (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('SecurityError: localStorage not available');
      });

      const { result } = renderHook(() => useRobotSetupWizard(ROBOT_ID));

      expect(result.current.currentStep).toBe(1);

      act(() => { result.current.advance(); });

      expect(result.current.currentStep).toBe(2);
      expect(result.current.state.completedSteps).toEqual([1]);
    });
  });

  describe('robotId change', () => {
    it('should re-read state when robotId changes', () => {
      const otherRobotId = 99;
      const otherKey = `robot-setup-${otherRobotId}`;
      const saved = { currentStep: 5, completedSteps: [1, 2, 3, 4], skippedSteps: [] };
      storage[otherKey] = JSON.stringify(saved);

      const { result, rerender } = renderHook(
        ({ robotId }) => useRobotSetupWizard(robotId),
        { initialProps: { robotId: ROBOT_ID } },
      );

      expect(result.current.currentStep).toBe(1);

      rerender({ robotId: otherRobotId });

      expect(result.current.currentStep).toBe(5);
    });
  });
});
