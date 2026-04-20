import React, { useRef, useEffect, useCallback } from 'react';
import {
  InterpolatedFrame,
  PlaybackRobotInfo,
  AttackIndicator,
  RangeBand,
  Position,
  KothZoneState,
  KothScoreEntry,
} from './types';
import {
  renderArenaBackground,
  renderArenaBoundary,
  renderRobot,
  renderAttackIndicator,
  renderRangeBandIndicator,
  renderTargetLine,
  arenaToPixel,
  renderKothZone,
  renderKothScoreboard,
  renderZoneOccupationIndicator,
} from './canvasRenderer';
import { useContainerSize } from '../../hooks/useContainerSize';

interface ArenaCanvasProps {
  arenaRadius: number;
  frame: InterpolatedFrame;
  robots: PlaybackRobotInfo[];
  attackIndicators: AttackIndicator[];
  currentTime: number;
  focusedRangeBand?: RangeBand;
  /** Names of the two currently fighting robots (for range band indicator) */
  activeRobotNames?: [string, string];
  /** Map of robot name → target robot name (for drawing target lines) */
  robotTargets?: Record<string, string>;
  /** KotH zone state (only present for KotH battles) */
  kothZone?: KothZoneState;
  /** KotH scores for scoreboard */
  kothScores?: KothScoreEntry[];
  /** KotH score threshold */
  kothScoreThreshold?: number;
}

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

/**
 * React component wrapping a Canvas element for 2D arena rendering.
 * Uses requestAnimationFrame at ~30fps. Responsive with minimum 300×300px.
 *
 * Validates: Requirements 17.1, 17.13
 */
export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({
  arenaRadius,
  frame,
  robots,
  attackIndicators,
  currentTime,
  focusedRangeBand,
  activeRobotNames,
  robotTargets,
  kothZone,
  kothScores,
  kothScoreThreshold,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(0);

  // Responsive sizing: observe container width, clamp to [300, 500]
  const { width: displaySize, devicePixelRatio } = useContainerSize(containerRef, {
    minSize: 300,
    maxSize: 500,
  });

  // Store latest props in refs so the render loop always reads current values
  const frameRef = useRef(frame);
  const robotsRef = useRef(robots);
  const attackIndicatorsRef = useRef(attackIndicators);
  const currentTimeRef = useRef(currentTime);
  const focusedRangeBandRef = useRef(focusedRangeBand);
  const activeRobotNamesRef = useRef(activeRobotNames);
  const robotTargetsRef = useRef(robotTargets);
  const kothZoneRef = useRef(kothZone);
  const kothScoresRef = useRef(kothScores);
  const kothScoreThresholdRef = useRef(kothScoreThreshold);

  useEffect(() => { frameRef.current = frame; }, [frame]);
  useEffect(() => { robotsRef.current = robots; }, [robots]);
  useEffect(() => { attackIndicatorsRef.current = attackIndicators; }, [attackIndicators]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { focusedRangeBandRef.current = focusedRangeBand; }, [focusedRangeBand]);
  useEffect(() => { activeRobotNamesRef.current = activeRobotNames; }, [activeRobotNames]);
  useEffect(() => { robotTargetsRef.current = robotTargets; }, [robotTargets]);
  useEffect(() => { kothZoneRef.current = kothZone; }, [kothZone]);
  useEffect(() => { kothScoresRef.current = kothScores; }, [kothScores]);
  useEffect(() => { kothScoreThresholdRef.current = kothScoreThreshold; }, [kothScoreThreshold]);

  // Update canvas pixel dimensions for HiDPI rendering when size or DPR changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelSize = Math.round(displaySize * devicePixelRatio);
    canvas.width = pixelSize;
    canvas.height = pixelSize;
  }, [displaySize, devicePixelRatio]);

  const renderFrame = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale context for HiDPI — draw in CSS pixel coordinates, not device pixels
    const dpr = devicePixelRatio || 1;
    const cssWidth = canvas.width / dpr;
    const cssHeight = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);

    const width = cssWidth;
    const height = cssHeight;
    const f = frameRef.current;
    const robs = robotsRef.current;
    const indicators = attackIndicatorsRef.current;
    const time = currentTimeRef.current;
    const rangeBand = focusedRangeBandRef.current;
    const activePair = activeRobotNamesRef.current;
    const targets = robotTargetsRef.current;
    const zone = kothZoneRef.current;
    const scores = kothScoresRef.current;
    const threshold = kothScoreThresholdRef.current;

    const toPixel = (pos: { x: number; y: number }): { x: number; y: number } =>
      arenaToPixel(pos, width, height, arenaRadius);

    // Arena center and radius in pixel coordinates (needed for background and boundary)
    const center = toPixel({ x: 0, y: 0 });
    const edgePoint = toPixel({ x: arenaRadius, y: 0 });
    const radiusPixels = Math.abs(edgePoint.x - center.x);

    // Clear and draw arena background (radial gradient + concentric grid)
    renderArenaBackground(ctx, width, height, center.x, center.y, radiusPixels);

    // Arena boundary
    renderArenaBoundary(ctx, center.x, center.y, radiusPixels);

    // KotH zone overlay (rendered after arena boundary, before robots)
    if (zone) {
      const zoneCenterPx = toPixel(zone.center);
      const zoneEdgePx = toPixel({ x: zone.center.x + zone.radius, y: zone.center.y });
      const zoneRadiusPx = Math.abs(zoneEdgePx.x - zoneCenterPx.x);
      const controllerIndex = zone.controllingRobotName
        ? robs.findIndex(r => r.name === zone.controllingRobotName)
        : undefined;

      // Convert previous center to pixel coordinates for zone transition animation
      const prevCenterPx = zone.previousCenter ? toPixel(zone.previousCenter) : undefined;

      renderKothZone(
        ctx,
        zoneCenterPx,
        zoneRadiusPx,
        zone.state,
        controllerIndex !== undefined && controllerIndex >= 0 ? controllerIndex : undefined,
        time,
        prevCenterPx,
        zone.transitionProgress,
      );
    }

    // Range band indicator between the two currently active robots
    if (rangeBand) {
      let pos1: Position | undefined;
      let pos2: Position | undefined;
      if (activePair) {
        pos1 = f.positions[activePair[0]];
        pos2 = f.positions[activePair[1]];
      } else if (robs.length === 2) {
        pos1 = f.positions[robs[0].name];
        pos2 = f.positions[robs[1].name];
      }
      if (pos1 && pos2) {
        renderRangeBandIndicator(ctx, toPixel(pos1), toPixel(pos2), rangeBand);
      }
    }

    // Target lines: draw a line from each robot to its current target
    if (targets) {
      for (const robot of robs) {
        const targetName = targets[robot.name];
        if (!targetName) continue;
        const fromPos = f.positions[robot.name];
        const toPos = f.positions[targetName];
        if (!fromPos || !toPos) continue;
        // Skip if HP is 0 (destroyed)
        const hp = f.hpValues[robot.name];
        if (hp !== undefined && hp <= 0) continue;
        renderTargetLine(ctx, toPixel(fromPos), toPixel(toPos), robot.teamIndex);
      }
    }

    // Robots
    for (const robot of robs) {
      const pos = f.positions[robot.name];
      if (!pos) continue;

      const pixelPos = toPixel(pos);
      const facing = f.facingDirections[robot.name] ?? 0;
      const hp = f.hpValues[robot.name] ?? robot.maxHP;
      const shield = f.shieldValues[robot.name] ?? 0;

      renderRobot(
        ctx,
        pixelPos,
        facing,
        robot.name,
        robot.teamIndex,
        hp,
        robot.maxHP,
        shield,
        robot.maxShield,
      );
    }

    // Zone occupation indicators (after robots, so crown renders on top)
    if (zone) {
      const occupantSet = new Set(zone.occupantNames);
      for (const robot of robs) {
        if (!occupantSet.has(robot.name)) continue;
        const pos = f.positions[robot.name];
        if (!pos) continue;
        renderZoneOccupationIndicator(ctx, toPixel(pos));
      }
    }

    // Attack indicators
    for (const indicator of indicators) {
      renderAttackIndicator(ctx, indicator, time, toPixel);
    }

    // KotH scoreboard (rendered last, on top of everything)
    if (scores && threshold !== undefined) {
      renderKothScoreboard(ctx, scores, width, threshold);
    }

    // Restore context (undo DPR scale)
    ctx.restore();
  }, [arenaRadius, devicePixelRatio]);

  // Animation loop at ~30fps
  useEffect(() => {
    const tick = (timestamp: number): void => {
      const elapsed = timestamp - lastRenderTimeRef.current;
      if (elapsed >= FRAME_INTERVAL) {
        lastRenderTimeRef.current = timestamp - (elapsed % FRAME_INTERVAL);
        renderFrame();
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [renderFrame]);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[500px] min-w-[300px] shrink-0 aspect-square"
    >
      <canvas
        ref={canvasRef}
        className="bg-[#0a0e14] rounded-lg"
        style={{ width: displaySize, height: displaySize }}
        aria-label="Battle arena playback canvas"
        role="img"
      />
    </div>
  );
};
