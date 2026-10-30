/**
 * A small horizontal effect bar around zero with a ±1 SE whisker. Green or red
 * only when significant. Decorative: the number next to it carries the value.
 */
import type { EffectEstimate } from './types';

export interface EffectBarProps {
  estimate: EffectEstimate;
  /** |effect| that fills half the bar. */
  scale: number;
  width?: number;
}

export function EffectBar({ estimate, scale, width = 96 }: EffectBarProps): React.ReactElement {
  const mid = width / 2;
  const px = (value: number): number => Math.max(0, Math.min(width, mid + (value / scale) * mid));
  const { effect, se, significant } = estimate;
  return (
    <svg width={width} height={12} viewBox={`0 0 ${width} 12`} aria-hidden="true" className="shrink-0">
      <rect x={0} y={1} width={width} height={10} rx={2} className="fill-background" />
      <line x1={mid} y1={0} x2={mid} y2={12} className="stroke-tertiary" />
      {effect !== null && (
        <>
          <rect
            x={Math.min(mid, px(effect))}
            y={2}
            width={Math.abs(px(effect) - mid)}
            height={8}
            rx={1}
            className={significant ? (effect > 0 ? 'fill-success' : 'fill-error') : 'fill-tertiary'}
          />
          {se !== null && <line x1={px(effect - se)} y1={6} x2={px(effect + se)} y2={6} className="stroke-white/60" />}
        </>
      )}
    </svg>
  );
}
