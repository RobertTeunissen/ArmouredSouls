import { useState, useEffect, type RefObject } from 'react';

const DEFAULT_MIN_SIZE = 300;
const DEFAULT_MAX_SIZE = 500;
const FALLBACK_SIZE = 500;
const FALLBACK_DEVICE_PIXEL_RATIO = 1;

interface ContainerSizeOptions {
  /** Minimum clamped size in pixels. Defaults to 300. */
  minSize?: number;
  /** Maximum clamped size in pixels. Defaults to 500. */
  maxSize?: number;
}

interface ContainerSize {
  /** Clamped width in CSS pixels. */
  width: number;
  /** Clamped height in CSS pixels (equal to width for 1:1 aspect ratio). */
  height: number;
  /** Device pixel ratio for HiDPI canvas rendering. Falls back to 1 if undefined. */
  devicePixelRatio: number;
}

function clampSize(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getDevicePixelRatio(): number {
  return typeof window !== 'undefined' && window.devicePixelRatio
    ? window.devicePixelRatio
    : FALLBACK_DEVICE_PIXEL_RATIO;
}

/**
 * Hook that tracks a container element's dimensions using ResizeObserver
 * and returns clamped width/height suitable for responsive canvas sizing.
 *
 * Falls back to a fixed 500px size if ResizeObserver is not supported.
 * Falls back to devicePixelRatio = 1 if undefined.
 *
 * The returned width and height are always equal (1:1 aspect ratio),
 * clamped between minSize (default 300) and maxSize (default 500).
 */
export function useContainerSize(
  ref: RefObject<HTMLElement | null>,
  options?: ContainerSizeOptions,
): ContainerSize {
  const minSize = options?.minSize ?? DEFAULT_MIN_SIZE;
  const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;

  const [size, setSize] = useState<ContainerSize>(() => ({
    width: FALLBACK_SIZE,
    height: FALLBACK_SIZE,
    devicePixelRatio: getDevicePixelRatio(),
  }));

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Fall back to fixed size if ResizeObserver is not supported
    if (typeof ResizeObserver === 'undefined') {
      setSize({
        width: FALLBACK_SIZE,
        height: FALLBACK_SIZE,
        devicePixelRatio: getDevicePixelRatio(),
      });
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        const clamped = clampSize(containerWidth, minSize, maxSize);
        setSize({
          width: clamped,
          height: clamped,
          devicePixelRatio: getDevicePixelRatio(),
        });
      }
    });

    observer.observe(element);

    // Read initial size
    const initialWidth = element.getBoundingClientRect().width;
    const clampedInitial = clampSize(initialWidth, minSize, maxSize);
    setSize({
      width: clampedInitial,
      height: clampedInitial,
      devicePixelRatio: getDevicePixelRatio(),
    });

    return () => {
      observer.disconnect();
    };
  }, [ref, minSize, maxSize]);

  return size;
}
