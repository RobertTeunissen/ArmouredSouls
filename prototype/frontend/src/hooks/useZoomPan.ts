import { useState, useRef, useCallback, useEffect } from 'react';

const MIN_SCALE = 0.2;
const MAX_SCALE = 2;
const ZOOM_STEP = 0.05;

export interface ZoomPanState {
  scale: number;
  translate: { x: number; y: number };
  isPanning: boolean;
  clampScale: (s: number) => number;
  handleWheel: (e: React.WheelEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

export function useZoomPan(resetDeps: unknown[] = []): ZoomPanState {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, resetDeps);

  const clampScale = useCallback(
    (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)),
    [],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setScale((prev) => clampScale(prev + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)));
  }, [clampScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 0) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      translateStart.current = { ...translate };
    }
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setTranslate({
      x: translateStart.current.x + (e.clientX - panStart.current.x),
      y: translateStart.current.y + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (lastTouchDistance.current !== null) {
      setScale((prev) => clampScale(prev + (distance - lastTouchDistance.current!) * 0.005));
    }
    lastTouchDistance.current = distance;
  }, [clampScale]);

  const handleTouchEnd = useCallback(() => { lastTouchDistance.current = null; }, []);

  const zoomIn = useCallback(() => setScale((s) => clampScale(s + 0.1)), [clampScale]);
  const zoomOut = useCallback(() => setScale((s) => clampScale(s - 0.1)), [clampScale]);
  const reset = useCallback(() => { setScale(1); setTranslate({ x: 0, y: 0 }); }, []);

  return {
    scale, translate, isPanning, clampScale,
    handleWheel, handleMouseDown, handleMouseMove, handleMouseUp,
    handleTouchMove, handleTouchEnd,
    zoomIn, zoomOut, reset,
  };
}
