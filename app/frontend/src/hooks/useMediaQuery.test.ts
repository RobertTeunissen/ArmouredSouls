/**
 * Unit tests for useMediaQuery and useIsMobile hooks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsMobile } from './useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Map<string, ((event: MediaQueryListEvent) => void)[]>;

  beforeEach(() => {
    listeners = new Map();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        const listenerList: ((event: MediaQueryListEvent) => void)[] = [];
        listeners.set(query, listenerList);

        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn((_event: string, handler: (event: MediaQueryListEvent) => void) => {
            listenerList.push(handler);
          }),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
      }),
    });
  });

  it('should return false when query does not match', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('should return true when query matches initially', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('should update when media query changes', () => {
    let changeHandler: ((event: MediaQueryListEvent) => void) | null = null;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn((_: string, handler: (event: MediaQueryListEvent) => void) => {
          changeHandler = handler;
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);

    // Simulate media query change
    act(() => {
      if (changeHandler) {
        changeHandler({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current).toBe(true);
  });
});

describe('useIsMobile', () => {
  it('should call matchMedia with max-width: 1023px', () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '(max-width: 1023px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia });

    renderHook(() => useIsMobile());
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 1023px)');
  });
});
