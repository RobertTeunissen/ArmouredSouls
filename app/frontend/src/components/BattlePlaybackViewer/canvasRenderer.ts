import { Position, AttackIndicator, RangeBand } from './types';

/** Team colors: indexes 0-5 for KotH (6 participants), 0-1 for 1v1/tag team */
const TEAM_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#22C55E', // green
  '#F97316', // orange
  '#A855F7', // purple
  '#06B6D4', // cyan
] as const;

/** Range band indicator colors */
const RANGE_BAND_COLORS: Record<RangeBand, string> = {
  melee: '#EF4444',
  short: '#F97316',
  mid: '#EAB308',
  long: '#22C55E',
};

/** Attack indicator colors by type */
const ATTACK_COLORS: Record<string, string> = {
  hit: '#22C55E',
  miss: '#9CA3AF',
  critical: '#EAB308',
  malfunction: '#EF4444',
};

const ROBOT_RADIUS = 14;
const HP_BAR_WIDTH = 40;
const HP_BAR_HEIGHT = 5;
const SHIELD_BAR_HEIGHT = 4;
const NAME_OFFSET_Y = -24;
const HP_BAR_OFFSET_Y = 20;

/** Clear the canvas */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Render the arena background with a radial gradient and concentric grid circles.
 * Replaces plain clearCanvas() in the render loop — clears the canvas first,
 * then draws a radial gradient from #0a0e14 (center) to #0f1318 (edge),
 * plus concentric circles at 25%/50%/75% of arena radius using #1a1f29.
 */
export function renderArenaBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  arenaRadiusPixels: number
): void {
  // Clear the canvas first
  ctx.clearRect(0, 0, width, height);

  // Draw radial gradient background
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, arenaRadiusPixels
  );
  gradient.addColorStop(0, '#0a0e14');
  gradient.addColorStop(1, '#0f1318');

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw concentric grid circles at 25%, 50%, 75% of arena radius
  const gridColor = '#1a1f29';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  for (const fraction of [0.25, 0.5, 0.75]) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, arenaRadiusPixels * fraction, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/** Render the circular arena boundary */
export function renderArenaBoundary(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusPixels: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPixels, 0, Math.PI * 2);
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#57606a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Get HP bar color based on HP percentage (green → yellow → red) */
function getHPColor(hpPercent: number): string {
  if (hpPercent > 0.6) return '#22C55E';
  if (hpPercent > 0.3) return '#EAB308';
  return '#EF4444';
}

/** Draw a hexagonal robot body with a "head" bump at the top (facing direction) */
function renderHexagonalBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  facingRad: number,
  fillColor: string,
  strokeColor: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(facingRad);

  // Hexagonal body
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2; // start from top
    const hx = Math.cos(angle) * radius;
    const hy = Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(hx, hy);
    } else {
      ctx.lineTo(hx, hy);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

/** Render a robot with team color, name, HP bar, and facing direction */
export function renderRobot(
  ctx: CanvasRenderingContext2D,
  position: { x: number; y: number },
  facingDeg: number,
  name: string,
  teamIndex: number,
  hp: number,
  maxHP: number,
  shield: number,
  maxShield: number,
): void {
  const { x, y } = position;
  const color = TEAM_COLORS[teamIndex] ?? TEAM_COLORS[0];
  const isDestroyed = hp <= 0 && maxHP > 0;
  // Negate facing angle to account for canvas Y-down vs arena Y-up coordinate system
  const facingRad = (-facingDeg * Math.PI) / 180;

  ctx.save();

  if (isDestroyed) {
    // Destroyed state: dimmed body with red X
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(x, y, ROBOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#374151';
    ctx.fill();
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Red X over the robot
    const xSize = ROBOT_RADIUS * 0.7;
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - xSize, y - xSize);
    ctx.lineTo(x + xSize, y + xSize);
    ctx.moveTo(x + xSize, y - xSize);
    ctx.lineTo(x - xSize, y + xSize);
    ctx.stroke();

    // 💀 label
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#EF4444';
    ctx.fillText('💀', x, y - ROBOT_RADIUS - 8);
  } else {
    // Render hexagonal robot body in team color
    renderHexagonalBody(ctx, x, y, ROBOT_RADIUS, facingRad, color, '#1F2937');

    // Facing direction arrow
    const arrowLen = ROBOT_RADIUS + 6;
    const arrowTipX = x + Math.cos(facingRad) * arrowLen;
    const arrowTipY = y + Math.sin(facingRad) * arrowLen;
    const arrowBaseOffset = Math.PI * 0.85;
    const arrowBaseLen = ROBOT_RADIUS * 0.6;

    ctx.beginPath();
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(
      x + Math.cos(facingRad + arrowBaseOffset) * arrowBaseLen,
      y + Math.sin(facingRad + arrowBaseOffset) * arrowBaseLen
    );
    ctx.lineTo(
      x + Math.cos(facingRad - arrowBaseOffset) * arrowBaseLen,
      y + Math.sin(facingRad - arrowBaseOffset) * arrowBaseLen
    );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Name label above robot
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = isDestroyed ? '#6B7280' : '#FFFFFF';
  ctx.fillText(name, x, y + NAME_OFFSET_Y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // HP bar below robot
  const hpPercent = maxHP > 0 ? Math.max(0, Math.min(1, hp / maxHP)) : 0;
  const hpBarX = x - HP_BAR_WIDTH / 2;
  const hpBarY = y + HP_BAR_OFFSET_Y;

  // HP bar background
  ctx.fillStyle = '#374151';
  ctx.fillRect(hpBarX, hpBarY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

  // HP bar fill
  if (hpPercent > 0) {
    ctx.fillStyle = getHPColor(hpPercent);
    ctx.fillRect(hpBarX, hpBarY, HP_BAR_WIDTH * hpPercent, HP_BAR_HEIGHT);
  }

  // Shield bar below HP bar (only if shield > 0)
  if (maxShield > 0 && shield > 0) {
    const shieldPercent = Math.max(0, Math.min(1, shield / maxShield));
    const shieldBarY = hpBarY + HP_BAR_HEIGHT + 1;

    ctx.fillStyle = '#374151';
    ctx.fillRect(hpBarX, shieldBarY, HP_BAR_WIDTH, SHIELD_BAR_HEIGHT);

    ctx.fillStyle = '#60A5FA';
    ctx.fillRect(hpBarX, shieldBarY, HP_BAR_WIDTH * shieldPercent, SHIELD_BAR_HEIGHT);
  }

  ctx.restore();
}

/** Render an attack indicator (projectile line for ranged, arc for melee) */
export function renderAttackIndicator(
  ctx: CanvasRenderingContext2D,
  indicator: AttackIndicator,
  currentTime: number,
  toPixel: (pos: Position) => { x: number; y: number }
): void {
  const elapsed = currentTime - indicator.timestamp;
  if (elapsed < 0 || elapsed > indicator.duration) return;

  const alpha = 1 - elapsed / indicator.duration;
  const color = ATTACK_COLORS[indicator.type] ?? ATTACK_COLORS.miss;
  const fromPx = toPixel(indicator.from);
  const toPx = toPixel(indicator.to);

  ctx.save();
  ctx.globalAlpha = alpha;

  if (indicator.isRanged) {
    // Ranged: thin line from attacker to defender
    ctx.beginPath();
    ctx.moveTo(fromPx.x, fromPx.y);
    ctx.lineTo(toPx.x, toPx.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // Melee: short arc near attacker toward defender
    const dx = toPx.x - fromPx.x;
    const dy = toPx.y - fromPx.y;
    const angle = Math.atan2(dy, dx);
    const arcRadius = ROBOT_RADIUS + 8;

    ctx.beginPath();
    ctx.arc(fromPx.x, fromPx.y, arcRadius, angle - 0.6, angle + 0.6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.restore();
}

/** Render range band indicator between two robots */
export function renderRangeBandIndicator(
  ctx: CanvasRenderingContext2D,
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
  rangeBand: RangeBand
): void {
  const color = RANGE_BAND_COLORS[rangeBand];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pos1.x, pos1.y);
  ctx.lineTo(pos2.x, pos2.y);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Render a target line from a robot to its current target, colored by the attacker's team */
export function renderTargetLine(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  teamIndex: number
): void {
  const color = TEAM_COLORS[teamIndex] ?? TEAM_COLORS[0];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Convert arena coordinates to pixel coordinates */
export function arenaToPixel(
  arenaPos: Position,
  canvasWidth: number,
  canvasHeight: number,
  arenaRadius: number
): { x: number; y: number } {
  const size = Math.min(canvasWidth, canvasHeight);
  const padding = 20;
  const drawSize = size - padding * 2;
  const scale = drawSize / (arenaRadius * 2);
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  return {
    x: centerX + arenaPos.x * scale,
    y: centerY - arenaPos.y * scale, // flip Y: arena Y-up → canvas Y-down
  };
}

/** 6-color palette for KotH participants */
export const KOTH_COLORS = ['#3B82F6', '#EF4444', '#22C55E', '#F97316', '#A855F7', '#06B6D4'] as const;

/** Render KotH control zone as translucent circular overlay */
export function renderKothZone(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  radiusPixels: number,
  state: 'uncontested' | 'contested' | 'empty' | 'inactive',
  controllerColorIndex?: number,
  animationTime?: number,
  previousCenter?: { x: number; y: number },
  transitionProgress?: number,
): void {
  ctx.save();

  // If we have a previous center and transition progress, render the animated transition
  const isTransitioning = previousCenter !== undefined && transitionProgress !== undefined;

  if (state === 'inactive' && isTransitioning) {
    // Zone is moving: fade out at old position, fade in at new position
    const fadeOut = Math.max(0, 1 - transitionProgress * 2); // fades out in first half
    const fadeIn = Math.max(0, transitionProgress * 2 - 1);  // fades in in second half

    // Fading-out zone at previous position
    if (fadeOut > 0) {
      ctx.globalAlpha = fadeOut;
      ctx.beginPath();
      ctx.arc(previousCenter.x, previousCenter.y, radiusPixels, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.fill();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Fading-in zone at new position
    if (fadeIn > 0) {
      ctx.globalAlpha = fadeIn;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radiusPixels, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.fill();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Pulsing "moving" label at midpoint between old and new positions
    const midX = previousCenter.x + (center.x - previousCenter.x) * transitionProgress;
    const midY = previousCenter.y + (center.y - previousCenter.y) * transitionProgress;
    const pulse = animationTime !== undefined ? 0.5 + 0.3 * Math.sin(animationTime * 6) : 0.7;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(midX, midY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#F59E0B';
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (state === 'inactive' && !isTransitioning) {
    // Inactive without transition data — original faded zone rendering
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPixels, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(107, 114, 128, 0.15)';
    ctx.fill();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(107, 114, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (isTransitioning && transitionProgress < 1) {
    // Zone just became active but transition is still completing — show both positions
    const fadeOut = Math.max(0, 1 - transitionProgress);
    const fadeIn = transitionProgress;

    // Fading-out ghost at previous position
    if (fadeOut > 0.05) {
      ctx.globalAlpha = fadeOut * 0.5;
      ctx.beginPath();
      ctx.arc(previousCenter.x, previousCenter.y, radiusPixels, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(107, 114, 128, 0.2)';
      ctx.fill();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(107, 114, 128, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Render the new zone at its active state with fade-in
    ctx.globalAlpha = fadeIn;
    renderKothZoneActive(ctx, center, radiusPixels, state, controllerColorIndex, animationTime);
    ctx.globalAlpha = 1;
  } else if (state === 'contested') {
    renderKothZoneActive(ctx, center, radiusPixels, state, controllerColorIndex, animationTime);
  } else if (state === 'uncontested' && controllerColorIndex !== undefined) {
    renderKothZoneActive(ctx, center, radiusPixels, state, controllerColorIndex, animationTime);
  } else {
    // Empty — gold/amber base
    renderKothZoneActive(ctx, center, radiusPixels, state, controllerColorIndex, animationTime);
  }

  ctx.restore();
}

/** Render the active KotH zone (non-transitioning states) */
function renderKothZoneActive(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  radiusPixels: number,
  state: 'uncontested' | 'contested' | 'empty' | 'inactive',
  controllerColorIndex?: number,
  animationTime?: number,
): void {
  if (state === 'contested') {
    // Pulsing red tint
    const pulse = animationTime !== undefined ? 0.3 + 0.15 * Math.sin(animationTime * 4) : 0.35;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPixels, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (state === 'uncontested' && controllerColorIndex !== undefined) {
    // Tinted with controlling robot's color
    const color = KOTH_COLORS[controllerColorIndex] ?? KOTH_COLORS[0];
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPixels, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // Empty — gold/amber base
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPixels, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Render KotH scoreboard panel on the canvas */
export function renderKothScoreboard(
  ctx: CanvasRenderingContext2D,
  scores: { robotName: string; zoneScore: number; isEliminated: boolean }[],
  canvasWidth: number,
  scoreThreshold: number,
): void {
  const panelWidth = 160;
  const panelX = canvasWidth - panelWidth - 8;
  const panelY = 8;
  const rowHeight = 16;
  const panelHeight = 20 + scores.length * rowHeight;
  const scoreColWidth = 40; // reserved for right-aligned score
  const nameMaxWidth = panelWidth - 12 - scoreColWidth; // 12 = left+right padding

  ctx.save();

  // Panel background
  ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  // Title
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#F59E0B';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`👑 KotH (${scoreThreshold})`, panelX + 6, panelY + 4);

  // Score rows
  ctx.font = '11px sans-serif';
  scores
    .slice()
    .sort((a, b) => b.zoneScore - a.zoneScore)
    .forEach((entry, i) => {
      const y = panelY + 18 + i * rowHeight;
      const color = KOTH_COLORS[i] ?? '#9CA3AF';
      const prefix = entry.isEliminated ? '☠ ' : '';
      const displayName = truncateText(ctx, prefix + entry.robotName, nameMaxWidth);

      // Name (left-aligned, truncated to fit)
      ctx.textAlign = 'left';
      ctx.fillStyle = entry.isEliminated ? '#6B7280' : color;
      ctx.fillText(displayName, panelX + 6, y);

      // Score (right-aligned)
      ctx.textAlign = 'right';
      ctx.fillStyle = entry.isEliminated ? '#6B7280' : '#E5E7EB';
      ctx.fillText(entry.zoneScore.toFixed(1), panelX + panelWidth - 6, y);
      ctx.textAlign = 'left';
    });

  ctx.restore();
}

/** Truncate text with ellipsis to fit within maxWidth pixels */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

/** Render zone occupation indicator on a robot (small crown icon above) */
export function renderZoneOccupationIndicator(
  ctx: CanvasRenderingContext2D,
  position: { x: number; y: number },
): void {
  ctx.save();
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('👑', position.x, position.y - 34);
  ctx.restore();
}
