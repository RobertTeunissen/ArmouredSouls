import { Position, AttackIndicator, RangeBand } from './types';

/** Team colors: team 0 = blue, team 1 = red */
const TEAM_COLORS = ['#3B82F6', '#EF4444'] as const;

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

const ROBOT_RADIUS = 12;
const HP_BAR_WIDTH = 30;
const HP_BAR_HEIGHT = 4;
const SHIELD_BAR_HEIGHT = 3;
const NAME_OFFSET_Y = -22;
const HP_BAR_OFFSET_Y = 18;

/** Clear the canvas */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);
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
  ctx.strokeStyle = '#4B5563';
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

/** Render a robot icon with team color, name, and facing direction */
export function renderRobot(
  ctx: CanvasRenderingContext2D,
  position: { x: number; y: number },
  facingDeg: number,
  name: string,
  teamIndex: number,
  hp: number,
  maxHP: number,
  shield: number,
  maxShield: number
): void {
  const { x, y } = position;
  const color = TEAM_COLORS[teamIndex] ?? TEAM_COLORS[0];
  // Negate facing angle to account for canvas Y-down vs arena Y-up coordinate system
  const facingRad = (-facingDeg * Math.PI) / 180;

  ctx.save();

  // Robot body circle
  ctx.beginPath();
  ctx.arc(x, y, ROBOT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 2;
  ctx.stroke();

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

  // Name label above robot
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = '#FFFFFF';
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
  ctx.fillStyle = getHPColor(hpPercent);
  ctx.fillRect(hpBarX, hpBarY, HP_BAR_WIDTH * hpPercent, HP_BAR_HEIGHT);

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
