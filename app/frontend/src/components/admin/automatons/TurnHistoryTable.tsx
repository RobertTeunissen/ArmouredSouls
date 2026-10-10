/**
 * Editor — Cycle history (Spec #55, R7.5, R11.2, PLAYER_FACING_TEXT §6.5 and
 * §6.6, task 10.3): the stable's Turn_Records, newest first, with the
 * Turn_Trigger labels {n} · Prep {n} · Season start. A table from 768 px,
 * cards below.
 */
import type { ReactNode } from 'react';
import type { TurnRecord } from '../../../utils/automatonAdminApi';
import { Card } from './ui';
import { cycleColumnLabel, formatCredits, savingGoalText, turnStatusLabel } from './automatonText';

function endedOn(record: TurnRecord): string {
  if (record.status === 'skipped') return record.reason === 'program_off' || record.reason === null ? 'Automatons stopped' : record.reason;
  if (record.status === 'failed') return record.reason ?? '—';
  const goal = record.savingGoal;
  if (goal && goal.label !== null && goal.target !== null) return `Saving for ${savingGoalText(goal.label, goal.target)}`;
  return record.actionCount > 0 ? `Bought ${record.actionCount}` : '—';
}

const spent = (record: TurnRecord): string => (record.status === 'skipped' ? '—' : formatCredits(record.creditsSpent));

export function TurnHistoryTable({ records }: { records: TurnRecord[] | null }): ReactNode {
  return (
    <Card title="Cycle history">
      {records === null ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-secondary">Never</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-secondary border-b border-white/10">
                  <th scope="col" className="py-2 pr-3 font-medium">Cycle</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Spent</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Ended on</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={`${r.seasonNumber}-${r.trigger}-${r.slot}-${r.attempt}`} className="border-b border-white/5">
                    <td className="py-2 pr-3">{cycleColumnLabel(r.trigger, r.slot)}</td>
                    <td className="py-2 pr-3">{turnStatusLabel(r.status, r.reason)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{spent(r)}</td>
                    <td className="py-2 pr-3">{endedOn(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-2 text-sm">
            {records.map((r) => (
              <li key={`${r.seasonNumber}-${r.trigger}-${r.slot}-${r.attempt}`} className="rounded-md border border-white/10 p-2">
                <p className="flex justify-between gap-2"><span className="font-medium">{cycleColumnLabel(r.trigger, r.slot)}</span><span>{turnStatusLabel(r.status, r.reason)}</span></p>
                <p className="text-secondary">{spent(r)} · {endedOn(r)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
