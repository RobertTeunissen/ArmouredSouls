/**
 * Price vs effect: one dot per weapon with an estimate. Top left = cheap and
 * strong (underpriced), bottom right = pricey and weak (overpriced). Green or
 * red only when significant; the strongest and weakest are labelled.
 */
import type { AnalysisColumn, WeaponRow } from './types';
import { formatEffect } from '../../../utils/adminAttributesFormat';
import { formatCost } from '../../../utils/adminWeaponsFormat';

export interface PriceEffectScatterProps {
  weapons: WeaponRow[];
  column: AnalysisColumn;
}

const W = 360;
const H = 240;
const PAD = { left: 40, right: 22, top: 12, bottom: 28 };
const LABELLED = 2;
const PRICE_STEPS = [25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000];

export function PriceEffectScatter({ weapons, column }: PriceEffectScatterProps): React.ReactElement {
  const points = weapons
    .map((w) => ({ weapon: w, effect: w.results[column].effect }))
    .filter((p): p is { weapon: WeaponRow; effect: { effect: number; se: number | null; significant: boolean } } => p.effect.effect !== null);
  if (points.length === 0) {
    return <p className="p-5 text-sm text-secondary">No weapon has enough fights in this mode yet.</p>;
  }
  const maxCost = Math.max(...points.map((p) => p.weapon.cost), 1);
  // Round ticks: the smallest "nice" step that covers the prices in at most four steps.
  const step = PRICE_STEPS.find((s) => s * 4 >= maxCost) ?? Math.ceil(maxCost / 4 / 1_000_000) * 1_000_000;
  const xMax = Math.ceil(maxCost / step) * step;
  const ticks = Array.from({ length: Math.round(xMax / step) + 1 }, (_, i) => i * step);
  const yMax = Math.max(4, Math.ceil(Math.max(...points.map((p) => Math.abs(p.effect.effect)))));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (cost: number): number => PAD.left + (cost / xMax) * plotW;
  const y = (effect: number): number => PAD.top + plotH / 2 - (effect / yMax) * (plotH / 2);
  const byEffect = [...points].sort((a, b) => b.effect.effect - a.effect.effect);
  const labelled = new Set([...byEffect.slice(0, LABELLED), ...byEffect.slice(-LABELLED)].map((p) => p.weapon.weaponId));

  return (
    <div className="space-y-2 p-4 sm:p-5">
      <p className="text-xs text-secondary">Top left: cheap and strong · bottom right: pricey and weak.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Price against effect for ${points.length} weapons`}>
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} rx={4} className="fill-background" />
        <line x1={PAD.left} y1={y(0)} x2={PAD.left + plotW} y2={y(0)} strokeDasharray="3 3" className="stroke-tertiary" />
        {[yMax, 0, -yMax].map((v) => (
          <text key={v} x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="fill-secondary text-[10px]">{v > 0 ? `+${v}` : v}</text>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="fill-secondary text-[10px]">{formatCost(t)}</text>
        ))}
        {points.map(({ weapon, effect }) => {
          const cx = x(weapon.cost);
          const cy = y(effect.effect);
          const right = cx > PAD.left + plotW * 0.6;
          return (
            <g key={weapon.weaponId}>
              <circle cx={cx} cy={cy} r={4} className={effect.significant ? (effect.effect > 0 ? 'fill-success' : 'fill-error') : 'fill-tertiary'}>
                <title>{`${weapon.name}: ${formatCost(weapon.cost)}, ${formatEffect(effect.effect)}`}</title>
              </circle>
              {labelled.has(weapon.weaponId) && (
                <text x={cx + (right ? -7 : 7)} y={cy + 4} textAnchor={right ? 'end' : 'start'} className="fill-white text-[10px]">{weapon.name}</text>
              )}
            </g>
          );
        })}
      </svg>
      <ul className="sr-only">
        {byEffect.map(({ weapon, effect }) => (
          <li key={weapon.weaponId}>{weapon.name}: {formatCost(weapon.cost)}, {formatEffect(effect.effect)}{effect.significant ? '' : ' (not significant)'}</li>
        ))}
      </ul>
    </div>
  );
}
