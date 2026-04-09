/**
 * Tests for useIsMobile hook
 *
 * Requirements: 24.1-24.7
 */

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../useIsMobile';

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth;

  function setViewportWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
  }

  afterEach(() => {
    setViewportWidth(originalInnerWidth);
  });

  it('should return true when window width is below 768px', () => {
    setViewportWidth(375);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('should return true at 767px', () => {
    setViewportWidth(767);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('should return false when window width is 768px', () => {
    setViewportWidth(768);
    const { result } = renderHook(() => useIsMobile());
    // Breakpoint is 1024px, so 768 is still mobile
    expect(result.current).toBe(true);
  });

  it('should return false when window width is above 768px', () => {
    setViewportWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('should update when window is resized from desktop to mobile', () => {
    setViewportWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setViewportWidth(375);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);
  });

  it('should update when window is resized from mobile to desktop', () => {
    setViewportWidth(375);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      setViewportWidth(1024);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(false);
  });

  it('should clean up resize listener on unmount', () => {
    setViewportWidth(1024);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useIsMobile());

    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
