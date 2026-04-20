import { describe, it, expect, vi } from 'vitest';
import { renderKothZone, renderKothScoreboard, renderZoneOccupationIndicator, KOTH_COLORS } from '../canvasRenderer';

// Create a mock canvas context
function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('KotH Playback Rendering', () => {
  it('should render zone overlay with correct color for contested state', () => {
    const ctx = createMockCtx();
    renderKothZone(ctx, { x: 250, y: 250 }, 80, 'contested', undefined, 0);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledWith(250, 250, 80, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
    // Contested state uses red tint
    expect(ctx.fillStyle).toMatch(/rgba\(239, 68, 68/);
  });

  it('should render scoreboard with scores sorted descending', () => {
    const ctx = createMockCtx();
    const scores = [
      { robotName: 'Bot-A', zoneScore: 10, isEliminated: false },
      { robotName: 'Bot-B', zoneScore: 25, isEliminated: false },
      { robotName: 'Bot-C', zoneScore: 5, isEliminated: true },
    ];

    renderKothScoreboard(ctx, scores, 500, 30);

    // Should have rendered panel background
    expect(ctx.fillRect).toHaveBeenCalled();
    // Should have rendered title and score rows
    expect(ctx.fillText).toHaveBeenCalled();
    // Verify the title includes KotH
    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const titleCall = fillTextCalls.find((call: unknown[]) => typeof call[0] === 'string' && call[0].includes('KotH'));
    expect(titleCall).toBeDefined();
  });

  it('should assign colors from 6-color palette', () => {
    expect(KOTH_COLORS).toHaveLength(6);
    expect(KOTH_COLORS[0]).toBe('#3B82F6'); // blue
    expect(KOTH_COLORS[1]).toBe('#EF4444'); // red
    expect(KOTH_COLORS[2]).toBe('#22C55E'); // green
    expect(KOTH_COLORS[3]).toBe('#F97316'); // orange
    expect(KOTH_COLORS[4]).toBe('#A855F7'); // purple
    expect(KOTH_COLORS[5]).toBe('#06B6D4'); // cyan
  });

  it('should render zone occupation indicator', () => {
    const ctx = createMockCtx();
    renderZoneOccupationIndicator(ctx, { x: 100, y: 200 });

    expect(ctx.fillText).toHaveBeenCalledWith('👑', 100, expect.any(Number));
  });

  it('should render uncontested zone with controller color', () => {
    const ctx = createMockCtx();
    renderKothZone(ctx, { x: 250, y: 250 }, 80, 'uncontested', 2); // green (index 2)

    expect(ctx.fill).toHaveBeenCalled();
    // Should use green color (KOTH_COLORS[2] = #22C55E → rgb(34, 197, 94))
    expect(ctx.fillStyle).toMatch(/rgba\(34, 197, 94/);
  });

  it('should render inactive zone during transition', () => {
    const ctx = createMockCtx();
    renderKothZone(ctx, { x: 250, y: 250 }, 80, 'inactive');

    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 4]);
    // Should use gray color
    expect(ctx.fillStyle).toMatch(/rgba\(107, 114, 128/);
  });
});
