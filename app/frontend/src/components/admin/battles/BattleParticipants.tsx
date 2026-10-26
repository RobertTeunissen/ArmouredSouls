/**
 * Participants of one battle as recorded on the battle: grouped by side for
 * two-sided modes, by placement for KotH and Grand Melee.
 */
import { StableTag } from './BattleBadges';
import type { BattleDetail, BattleParticipantDetail } from './types';
import { formatCredits, formatEventTime, formatNumber } from '../../../utils/adminBattlesFormat';

function fate(p: BattleParticipantDetail): { text: string; tone: string } {
  const at = p.survivalSeconds !== null ? ` at ${formatEventTime(p.survivalSeconds)}` : '';
  if (p.forfeited) return { text: 'Forfeited', tone: 'text-warning' };
  if (p.destroyed) return { text: `Destroyed${at}`, tone: 'text-error' };
  if (p.yielded) return { text: `Yielded${at}`, tone: 'text-warning' };
  return { text: 'Survived', tone: 'text-secondary' };
}

function Row({ p, placement }: { p: BattleParticipantDetail; placement: boolean }): React.ReactElement {
  const delta = p.eloAfter - p.eloBefore;
  const f = fate(p);
  return (
    <tr className="border-t border-white/5 align-top">
      <td className="py-2 pl-4 pr-2">
        <p className="text-white">
          {placement && p.placement !== null && <span className="mr-1.5 text-secondary">{p.placement}.</span>}
          {p.robotName}
        </p>
        <p className={`text-xs ${f.tone}`}>{f.text}</p>
        {placement && p.stable && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-tertiary"><StableTag kind={p.stable.stableType} />{p.stable.name}</p>
        )}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">{formatNumber(p.finalHP)}{p.maxHP !== null && <span className="text-tertiary"> / {formatNumber(p.maxHP)}</span>}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatNumber(p.damageDealt)}</td>
      {placement ? (
        <td className="px-2 py-2 text-right tabular-nums">
          {p.zoneScore !== null ? p.zoneScore.toFixed(1) : '—'}
          <p className="text-xs text-tertiary">{p.kills !== null ? `${p.kills} kills` : ''}</p>
        </td>
      ) : (
        <td className="px-2 py-2 text-right tabular-nums">
          <span className={delta > 0 ? 'text-success' : delta < 0 ? 'text-error' : 'text-secondary'}>{delta > 0 ? '+' : delta < 0 ? '−' : '±'}{Math.abs(delta)}</span>
          <p className="text-xs text-tertiary">{p.eloBefore} → {p.eloAfter}</p>
        </td>
      )}
      <td className="px-2 py-2 text-right tabular-nums">{formatCredits(p.credits)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatCredits(p.streamingRevenue)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{p.prestigeAwarded}</td>
      <td className="py-2 pl-2 pr-4 text-right tabular-nums">{p.fameAwarded}</td>
    </tr>
  );
}

export function BattleParticipants({ battle }: { battle: BattleDetail }): React.ReactElement {
  const placement = battle.sides.length === 0;
  if (battle.participants.length === 0) {
    return <p className="rounded-lg bg-surface-elevated px-4 py-3 text-sm text-secondary">No participant rows: the robots were deleted (account reset or bot purge).</p>;
  }
  const groups = placement
    ? [{ key: 'field', side: null, rows: [...battle.participants].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99)) }]
    : battle.sides.map((side) => ({ key: `side-${side.team}`, side, rows: battle.participants.filter((p) => p.team === side.team) }));

  return (
    <div className="overflow-x-auto rounded-lg bg-surface-elevated">
      <table className="w-full min-w-[40rem] text-sm text-white">
        <caption className="sr-only">Participants of battle #{battle.id}</caption>
        <thead className="text-xs font-semibold uppercase tracking-wide text-secondary">
          <tr>
            <th scope="col" className="py-2.5 pl-4 pr-2 text-left">Robot</th>
            <th scope="col" className="px-2 py-2.5 text-right">End HP</th>
            <th scope="col" className="px-2 py-2.5 text-right">Damage</th>
            <th scope="col" className="px-2 py-2.5 text-right">{placement ? 'Zone' : 'ELO'}</th>
            <th scope="col" className="px-2 py-2.5 text-right">Credits</th>
            <th scope="col" className="px-2 py-2.5 text-right">Streaming</th>
            <th scope="col" className="px-2 py-2.5 text-right">Prestige</th>
            <th scope="col" className="py-2.5 pl-2 pr-4 text-right">Fame</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key}>
            {group.side && (
              <tr className="border-t border-white/10 bg-white/[0.03]">
                <th scope="rowgroup" colSpan={8} className="px-4 py-2 text-left text-xs font-normal">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">Side {group.side.team} · {group.side.label}</span>
                    {group.side.stable && <span className="text-secondary">{group.side.stable.name}</span>}
                    {group.side.stable && <StableTag kind={group.side.stable.stableType} />}
                    {group.side.isWinner && <span className="rounded-full bg-success/15 px-2 py-px text-[10px] font-semibold text-success">Won</span>}
                  </span>
                </th>
              </tr>
            )}
            {group.rows.map((p) => <Row key={p.robotId} p={p} placement={placement} />)}
          </tbody>
        ))}
      </table>
    </div>
  );
}
