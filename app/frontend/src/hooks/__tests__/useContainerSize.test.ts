/**
 * Tests for useContainerSize hook
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContainerSize } from '../useContainerSize';
import { createRef } from 'react';

// --- ResizeObserver mock ---

type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

let resizeObserverCallback: ResizeObserverCallback | null = null;
let observedElements: Set<Element> = new Set();

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }
  observe(target: Element): void {
    observedElements.add(target);
  }
  unobserve(target: Element): void {
    observedElements.delete(target);
  }
  disconnect(): void {
    observedElements.clear();
    resizeObserverCallback = null;
  }
}

function triggerResize(width: number, height: number = 0): void {
  if (!resizeObserverCallback) return;
  const entry = {
    contentRect: { width, height, top: 0, left: 0, bottom: height, right: width, x: 0, y: 0, toJSON: () => ({}) },
    target: document.createElement('div'),
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  } as unknown as ResizeObserverEntry;
  resizeObserverCallback([entry]);
}

// --- Helpers ---

function createMockElement(width: number): HTMLDivElement {
  const el = document.createElement('div');
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return el;
}

describe('useContainerSize', () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalDevicePixelRatio = window.devicePixelRatio;

  beforeEach(() => {
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    resizeObserverCallback = null;
    observedElements = new Set();
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: 2,
    });
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: originalDevicePixelRatio,
    });
  });

  it('should return fallback 500px when ref is null', () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current.width).toBe(500);
    expect(result.current.height).toBe(500);
  });

  it('should return clamped size from initial element width', () => {
    const el = createMockElement(450);
    const ref = { current: el };

    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current.width).toBe(450);
    expect(result.current.height).toBe(450);
  });

  it('should clamp to minSize (300) when container is smaller', () => {
    const el = createMockElement(200);
    const ref = { current: el };

    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current.width).toBe(300);
    expect(result.current.height).toBe(300);
  });

  it('should clamp to maxSize (500) when container is larger', () => {
    const el = createMockElement(800);
    const ref = { current: el };

    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current.width).toBe(500);
    expect(result.current.height).toBe(500);
  });

  it('should maintain 1:1 aspect ratio (width === height)', () => {
    const el = createMockElement(400);
    const ref = { current: el };

    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current.width).toBe(result.current.height);
  });

  it('should accept custom minSize and maxSize options', () => {
    const el = createMockElement(100);
    const ref = { current: el };

    const { result } = renderHook(() =>
      useContainerSize(ref, { minSize: 200, maxSize: 400 }),
    );

    expect(result.current.width).toBe(200);
    expect(result.current.height).toBe(200);
  });

  it('should update size when ResizeObserver fires', () => {
    const el = createMockElement(400);
    const ref = { current: el };

    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current.width).toBe(400);

    act(() => {
      triggerResize(350);
    });

    expect(result.current.width).toBe(350);
    expect(result.current.height).toBe(350);
  });

  it('should clamp ResizeObserver updates to [300, 500]', () => {
    const el = createMockElement(400);
    const ref = { current: el };

    const { result } = renderHook(() => useContainerSize(ref));

    act(() => {
      triggerResize(150);
    });
    expect(result.current.width).toBe(300);

    act(() => {
      triggerResize(900);
    });
    expect(result.current.width).toBe(500);
  });

  it('should return devicePixelRatio from window', () => {
    const el = createMockElement(400);
    const ref = { current: el };

    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current.devicePixelRatio).toBe(2);
  });

  it('should fall back to devicePixelRatio = 1 when undefined', () => {
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    const el = createMockElement(400);
    const ref = { current: el };

    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current.devicePixelRatio).toBe(1);
  });

  it('should fall back to 500px fixed size when ResizeObserver is not supported', () => {
    // Remove ResizeObserver
    (globalThis as Record<string, unknown>).ResizeObserver = undefined;

    const el = createMockElement(400);
    const ref = { current: el };

    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current.width).toBe(500);
    expect(result.current.height).toBe(500);
  });

  it('should disconnect observer on unmount', () => {
    const el = createMockElement(400);
    const ref = { current: el };

    const { unmount } = renderHook(() => useContainerSize(ref));

    expect(observedElements.size).toBe(1);

    unmount();

    // After disconnect, the callback should be null
    expect(resizeObserverCallback).toBeNull();
  });
});
