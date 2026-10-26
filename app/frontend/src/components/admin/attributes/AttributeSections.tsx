/**
 * The smaller sections of the Attributes page: column summary, biggest
 * effects, group combinations, build profiles, model fit by layer and the
 * method note.
 */
import { EffectValue } from './EffectCell';
import {
  ANALYSIS_COLUMNS,
  ATTRIBUTE_GROUPS,
  type AnalysisColumn,
  type AnalysisColumnSummary,
  type AttributeEffectRow,
  type AttributeGroup,
  type BuildProfileRow,
  type GroupEffectRow,
  type GroupPairRow,
  type LayerFitSummary,
} from './types';
import {
  attributeLabel,
  columnDetail,
  columnLabel,
  formatCount,
  formatEffect,
  formatShare,
  groupFullLabel,
  groupLabel,
  layerStepLabel,
  profileLabel,
} from '../../../utils/adminAttributesFormat';

// ── Column summary ───────────────────────────────────────────────────

export function ColumnSummaries({ columns, selected }: { columns: AnalysisColumnSummary[]; selected: AnalysisColumn }): React.ReactElement {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Battles per mode column">
      {ANALYSIS_COLUMNS.map((column) => {
        const s = columns.find((c) => c.column === column);
        if (!s) return null;
        return (
          <li key={column} className={`rounded-lg border bg-surface px-4 py-3 ${column === selected ? 'border-primary/50' : 'border-white/10'}`}>
            <p className="text-xs uppercase tracking-wide text-secondary" title={columnDetail(column)}>{columnLabel(column)}</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatCount(s.battles)} <span className="text-sm font-normal text-secondary">battles</span></p>
            <p className="text-xs text-secondary">{formatCount(s.comparisons)} comparisons{!s.enough && ' · too few to analyse'}</p>
            {s.enough && (
              <p className="mt-1 text-xs text-secondary">
                10% more points than the opponent:{' '}
                <span className="whitespace-nowrap font-semibold text-white">{formatEffect(s.investmentEffect.effect)}</span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Biggest effects ──────────────────────────────────────────────────

export function BiggestEffects({ attributes, column }: { attributes: AttributeEffectRow[]; column: AnalysisColumn }): React.ReactElement {
  const significant = attributes.filter((a) => a.effects[column].significant && a.effects[column].effect !== null);
  const helps = significant.filter((a) => (a.effects[column].effect ?? 0) > 0)
    .sort((a, b) => (b.effects[column].effect ?? 0) - (a.effects[column].effect ?? 0)).slice(0, 5);
  const hurts = significant.filter((a) => (a.effects[column].effect ?? 0) < 0)
    .sort((a, b) => (a.effects[column].effect ?? 0) - (b.effects[column].effect ?? 0)).slice(0, 5);

  const list = (title: string, rows: AttributeEffectRow[], empty: string): React.ReactElement => (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-tertiary">{empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.attribute} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-white">
                {attributeLabel(row.attribute)} <span className="text-xs text-secondary">· {groupLabel(row.group)}</span>
              </span>
              <EffectValue estimate={row.effects[column]} withSe={false} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  return (
    <div className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-1">
      {list('Helps most', helps, 'No attribute helps significantly.')}
      {list('Hurts most', hurts, 'No attribute hurts significantly.')}
    </div>
  );
}

// ── Group combinations ───────────────────────────────────────────────

export interface GroupMatrixProps {
  groups: GroupEffectRow[];
  pairs: GroupPairRow[];
  column: AnalysisColumn;
}

function pairOf(pairs: GroupPairRow[], a: AttributeGroup, b: AttributeGroup): GroupPairRow | undefined {
  return pairs.find((p) => (p.groups[0] === a && p.groups[1] === b) || (p.groups[0] === b && p.groups[1] === a));
}

export function GroupMatrix({ groups, pairs, column }: GroupMatrixProps): React.ReactElement {
  return (
    <div className="space-y-3 p-5">
      <p className="text-xs text-secondary">
        Diagonal: moving 5 share points into the group. Above it: the extra win chance when both groups are 10 share points above average, beyond what each adds alone ({columnLabel(column)}).
      </p>
      <div className="hidden overflow-x-auto md:block">
        <table className="text-sm">
          <caption className="sr-only">Group effects on the diagonal and pair synergies above it, in percentage points.</caption>
          <thead>
            <tr>
              <td />
              {ATTRIBUTE_GROUPS.map((g) => (
                <th key={g} scope="col" className="px-2 pb-2 text-center text-xs font-semibold text-secondary" title={groupFullLabel(g)}>{groupLabel(g)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ATTRIBUTE_GROUPS.map((row, i) => (
              <tr key={row}>
                <th scope="row" className="pr-3 text-left text-xs font-semibold text-secondary" title={groupFullLabel(row)}>{groupLabel(row)}</th>
                {ATTRIBUTE_GROUPS.map((col, j) => {
                  if (j < i) return <td key={col} className="p-1" aria-hidden="true" />;
                  const estimate = j === i
                    ? groups.find((g) => g.group === row)?.effects[column]
                    : pairOf(pairs, row, col)?.effects[column];
                  return (
                    <td key={col} className={`p-1 text-center ${j === i ? 'rounded border border-white/10' : ''}`}>
                      {estimate ? <EffectValue estimate={estimate} /> : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        <ul className="space-y-1.5" aria-label="Group effects">
          {groups.map((g) => (
            <li key={g.group} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white">{groupFullLabel(g.group)}</span>
              <EffectValue estimate={g.effects[column]} />
            </li>
          ))}
        </ul>
        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-secondary">Pairs</h3>
        <ul className="space-y-1.5" aria-label="Group pair synergies">
          {pairs.map((p) => (
            <li key={p.groups.join('+')} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white">{groupLabel(p.groups[0])} + {groupLabel(p.groups[1])}</span>
              <EffectValue estimate={p.effects[column]} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Build profiles ───────────────────────────────────────────────────

function winRateText(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

function winRateTone(rate: number | null): string {
  if (rate === null) return 'text-tertiary';
  if (rate >= 0.55) return 'text-success font-semibold';
  if (rate <= 0.45) return 'text-error font-semibold';
  return 'text-white';
}

export function BuildProfilesTable({ profiles, column }: { profiles: BuildProfileRow[]; column: AnalysisColumn }): React.ReactElement {
  if (profiles.length === 0) return <p className="p-5 text-sm text-secondary">No robots in this window.</p>;
  return (
    <div className="space-y-3">
      <p className="px-5 pt-4 text-xs text-secondary">
        A group is “heavy” at 1.5× the share an even spread gives it; a pair has both groups at 1.25× or more. Win rate against a different profile with a total within about 10% ({columnLabel(column)}; shown from 50 comparisons).
      </p>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Build profiles: win rate at comparable investment, comparisons, and how common each profile is.</caption>
          <thead className="bg-surface-elevated text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th scope="col" className="px-5 py-3 text-left">Profile</th>
              <th scope="col" className="px-3 py-3 text-right">Win rate</th>
              <th scope="col" className="px-3 py-3 text-right">Comparisons</th>
              <th scope="col" className="px-3 py-3 text-right">Robots</th>
              <th scope="col" className="px-5 py-3 text-right">Players&apos; robots</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.profile} className="border-t border-white/5">
                <th scope="row" className="px-5 py-2 text-left font-normal text-white">{profileLabel(p.profile)}</th>
                <td className={`px-3 py-2 text-right tabular-nums ${winRateTone(p.results[column].winRate)}`}>{winRateText(p.results[column].winRate)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-secondary">{formatCount(p.results[column].comparisons)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-secondary">{formatShare(p.shareAll)}</td>
                <td className="px-5 py-2 text-right tabular-nums text-secondary">{formatShare(p.sharePlayers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 px-4 pb-4 md:hidden" aria-label="Build profiles">
        {profiles.map((p) => (
          <li key={p.profile} className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-white">{profileLabel(p.profile)}</p>
              <p className="text-xs text-secondary">
                {formatCount(p.results[column].comparisons)} comparisons · robots {formatShare(p.shareAll)} · players {formatShare(p.sharePlayers)}
              </p>
            </div>
            <span className={`text-sm tabular-nums ${winRateTone(p.results[column].winRate)}`}>{winRateText(p.results[column].winRate)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Model fit by layer ───────────────────────────────────────────────

export function LayerFitTable({ fit }: { fit: LayerFitSummary | null }): React.ReactElement {
  if (!fit) return <p className="p-5 text-sm text-secondary">Not enough battles in this window to compare the layers.</p>;
  return (
    <div className="space-y-3 p-5">
      <p className="text-xs text-secondary">
        How well each set of values predicts held-out battles (All modes; trained on {formatCount(fit.trainComparisons)}, tested on {formatCount(fit.testComparisons)} comparisons). A coin flip scores 0.693 log-loss and 50%. Lower log-loss and higher accuracy mean the layer matters.
      </p>
      <table className="w-full text-sm">
        <caption className="sr-only">Prediction quality per cumulative layer.</caption>
        <thead className="text-xs font-semibold uppercase tracking-wide text-secondary">
          <tr>
            <th scope="col" className="py-2 text-left">Values</th>
            <th scope="col" className="hidden px-2 py-2 text-right sm:table-cell">Log-loss</th>
            <th scope="col" className="px-2 py-2 text-right">Accuracy</th>
            <th scope="col" className="py-2 pl-2 text-right">Change (pp)</th>
          </tr>
        </thead>
        <tbody>
          {fit.rows.map((row, i) => {
            const previous = i > 0 ? fit.rows[i - 1] : null;
            const change = previous ? (row.accuracy - previous.accuracy) * 100 : null;
            return (
              <tr key={row.layer} className="border-t border-white/5">
                <th scope="row" className="py-2 text-left font-normal text-white">{layerStepLabel(row.layer)}</th>
                <td className="hidden px-2 py-2 text-right tabular-nums text-secondary sm:table-cell">{row.logLoss.toFixed(3)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-white">{(row.accuracy * 100).toFixed(1)}%</td>
                <td className={`whitespace-nowrap py-2 pl-2 text-right tabular-nums ${change === null ? 'text-tertiary' : change > 0.05 ? 'text-success' : change < -0.05 ? 'text-error' : 'text-secondary'}`}>
                  {change === null ? '—' : formatEffect(change).replace(' pp', '')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Method ───────────────────────────────────────────────────────────

export function MethodNote(): React.ReactElement {
  return (
    <div className="space-y-2 p-5 text-sm text-secondary">
      <p>
        Every fought battle becomes paired comparisons: side against side in 1v1 and team modes (a team is the average of its robots), and every pair of robots with different placements in King of the Hill and Grand Melee (each battle weighs half its field; Grand Melee uses up to 30 sampled pairs). Byes, forfeits, draws and tied placements are left out.
      </p>
      <p>
        A logistic model compares the two sides’ shares of points per attribute and controls for the difference in total points, so an attribute scores well only when spending points on it beats spending them elsewhere. Standard errors are clustered by battle. Values come from the battle-time build of each robot, so later upgrades never change the result.
      </p>
      <p>
        The effect is an association, not a guarantee: builds that put points into one attribute often share other choices (weapons, stance). The layer toggles and the model fit by layer help separate them. Generated stables’ random builds give most of the variation; “Players’ share” shows what human players actually build.
      </p>
    </div>
  );
}
