import { Link } from 'react-router-dom';
import type { DamageFlow } from '../../utils/battleStatistics';
import type { DamageFlowDiagramProps } from './types';
import type { BattleLogParticipant } from '../../utils/matchmakingApi';

/**
 * DamageFlowDiagram — heatmap grid showing who damaged whom.
 *
 * Only renders for 3+ robots (tag team, KotH). For 1v1 the combat
 * statistics table already shows damage dealt/received per robot.
 *
 * Rows = attackers, columns = defenders. Cell color intensity scales
 * with damage relative to the maximum flow. Diagonal cells (self) are
 * blacked out. Uses participants[] for consistent ordering and links.
 */

/** Build a lookup map: "attacker→defender" → damage */
function buildFlowMap(flows: DamageFlow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const f of flows) {
    map.set(`${f.source}→${f.target}`, (map.get(`${f.source}→${f.target}`) ?? 0) + f.value);
  }
  return map;
}

/** Interpolate between transparent and the accent color based on ratio 0–1 */
function heatColor(ratio: number): string {
  if (ratio <= 0) return 'transparent';
  const t = Math.sqrt(Math.min(ratio, 1));
  const r = Math.round(30 + t * (248 - 30));
  const g = Math.round(31 + t * (81 - 31));
  const b = Math.round(41 + t * (73 - 41));
  const a = 0.25 + t * 0.65;
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

/** Get ordered participant names — uses participants[] canonical order from the page.
 *  Includes ALL participants even if they have no damage flows (e.g. tag team reserves). */
function getOrderedNames(damageFlows: DamageFlow[], participants?: BattleLogParticipant[]): { names: string[]; participantMap: Map<string, BattleLogParticipant> } {
  const participantMap = new Map<string, BattleLogParticipant>();
  if (participants?.length) {
    for (const p of participants) participantMap.set(p.robotName, p);
    // Use all participant names in canonical order
    const names = participants.map(p => p.robotName);
    return { names, participantMap };
  }

  // Fallback: encounter order from flows
  const seen = new Set<string>();
  const names: string[] = [];
  for (const flow of damageFlows) {
    if (!seen.has(flow.source)) { seen.add(flow.source); names.push(flow.source); }
    if (!seen.has(flow.target)) { seen.add(flow.target); names.push(flow.target); }
  }
  return { names, participantMap };
}

export function DamageFlowDiagram({
  damageFlows,
  battleType,
  battleLog,
  selectedRobotIndex,
}: DamageFlowDiagramProps): React.ReactNode {
  const validFlows = (damageFlows ?? []).filter(f => f.value > 0);
  const { names, participantMap } = getOrderedNames(validFlows, battleLog?.participants);

  // Only show for 3+ robots — 1v1 damage is already in the stats table
  if (names.length < 3 || validFlows.length === 0) {
    return null;
  }

  const flowMap = buildFlowMap(validFlows);
  const maxDamage = Math.max(...validFlows.map(f => f.value), 1);

  // Mobile: show damage dealt/received list for selected robot
  if (selectedRobotIndex !== undefined) {
    const selectedName = (battleLog?.participants ?? [])[selectedRobotIndex]?.robotName ?? names[0];
    return (
      <div className="bg-surface rounded-lg mb-3 p-3">
        <h3 className="text-lg font-bold mb-3">🔀 Damage Breakdown</h3>
        <table className="w-full text-xs border-collapse">
          <tbody>
            <tr><td colSpan={2} className="pt-1 pb-0.5"><span className="text-xs font-bold text-secondary">Dealt</span></td></tr>
            {names.filter(n => n !== selectedName).map(target => {
              const dmg = flowMap.get(`${selectedName}→${target}`) ?? 0;
              return (
                <tr key={`dealt-${target}`} className="border-t border-white/5">
                  <td className="py-0.5 pr-2 text-secondary whitespace-nowrap">→ {truncName(target)}</td>
                  <td className="py-0.5 px-2 text-white font-medium">{dmg}</td>
                </tr>
              );
            })}
            <tr><td colSpan={2} className="pt-2 pb-0.5"><span className="text-xs font-bold text-secondary">Received</span></td></tr>
            {names.filter(n => n !== selectedName).map(source => {
              const dmg = flowMap.get(`${source}→${selectedName}`) ?? 0;
              return (
                <tr key={`recv-${source}`} className="border-t border-white/5">
                  <td className="py-0.5 pr-2 text-secondary whitespace-nowrap">← {truncName(source)}</td>
                  <td className="py-0.5 px-2 text-white font-medium">{dmg}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Compute row totals (damage dealt by attacker) and column totals (damage received by defender)
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  for (const attacker of names) {
    let rowSum = 0;
    for (const defender of names) {
      if (attacker === defender) continue;
      const dmg = flowMap.get(`${attacker}→${defender}`) ?? 0;
      rowSum += dmg;
      colTotals.set(defender, (colTotals.get(defender) ?? 0) + dmg);
    }
    rowTotals.set(attacker, rowSum);
  }

  const renderName = (name: string): React.ReactNode => {
    const p = participantMap.get(name);
    const display = truncName(name);
    if (p) return <Link to={`/robots/${p.robotId}`} className="text-primary hover:text-white transition-colors">{display}</Link>;
    return display;
  };

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">🔀 Damage Matrix</h3>
      <p className="text-xs text-secondary mb-2">Rows = attacker, columns = defender</p>

      <div className="overflow-x-auto" data-testid="damage-flow-diagram">
        <table className="w-full text-xs border-collapse" style={{ minWidth: `${names.length * 80 + 180}px` }}>
          <thead>
            <tr className="text-secondary">
              <th className="text-left py-1 pr-2 font-medium" style={{ width: '120px' }} />
              {names.map(name => (
                <th key={name} className="py-1 px-1 text-center font-bold text-white truncate" style={{ maxWidth: '100px' }}>
                  {renderName(name)}
                </th>
              ))}
              <th className="py-1 px-1 text-center font-bold text-secondary" style={{ minWidth: '60px' }}>Dealt</th>
            </tr>
          </thead>
          <tbody>
            {names.map(attacker => (
              <tr key={attacker} className="border-t border-white/5">
                <td className="py-0.5 pr-2 text-secondary font-medium whitespace-nowrap truncate" style={{ maxWidth: '120px' }}>
                  {renderName(attacker)}
                </td>
                {names.map(defender => {
                  const isSelf = attacker === defender;
                  const dmg = flowMap.get(`${attacker}→${defender}`) ?? 0;
                  const ratio = dmg / maxDamage;

                  if (isSelf) {
                    return (
                      <td key={defender} className="py-0.5 px-1 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <span className="text-tertiary">—</span>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={defender}
                      className="py-0.5 px-1 text-center font-medium text-white"
                      style={{ background: heatColor(ratio), minWidth: '60px' }}
                    >
                      {dmg > 0 ? dmg : '0'}
                    </td>
                  );
                })}
                <td className="py-0.5 px-1 text-center font-bold text-white border-l border-white/5">
                  {rowTotals.get(attacker) ?? 0}
                </td>
              </tr>
            ))}
            {/* Footer row: total damage received per defender */}
            <tr className="border-t border-white/5">
              <td className="py-0.5 pr-2 text-secondary font-bold whitespace-nowrap">Received</td>
              {names.map(defender => (
                <td key={defender} className="py-0.5 px-1 text-center font-bold text-white">
                  {colTotals.get(defender) ?? 0}
                </td>
              ))}
              <td className="py-0.5 px-1 text-center text-tertiary border-l border-white/5">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function truncName(name: string): string {
  return name.length > 14 ? name.slice(0, 12) + '…' : name;
}
