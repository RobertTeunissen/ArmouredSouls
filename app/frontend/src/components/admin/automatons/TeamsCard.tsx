/**
 * Editor — Teams card (Spec #55, R3.6, R5.9, design §17.2, task 10.3): one
 * row per Team_Rule team the stable can form, with its team name (Team_Names),
 * size, member robots and state Formed / Waits for robot {n}. A table from
 * 768 px; below it a one-line summary and one card per team.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Card, FieldError, FOCUS_RING, INPUT_CLASS } from './ui';
import { membersText, teamStateText, teamsSummary, type TeamRow } from './teamState';

export interface TeamsCardProps {
  rows: TeamRow[];
  error?: string | null;
  onNameChange: (size: 2 | 3, index: number, name: string) => void;
}

export function TeamsCard({ rows, error, onNameChange }: TeamsCardProps): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const nameInput = (row: TeamRow, extra = ''): ReactNode => (
    <input
      aria-label={`Team name: ${row.size}v${row.size} robots ${row.slots.join('+')}`}
      className={`${INPUT_CLASS} ${extra}`}
      value={row.name}
      maxLength={32}
      onChange={(e) => onNameChange(row.size, row.index, e.target.value)}
    />
  );

  return (
    <Card title="Teams">
      <p className="text-sm text-secondary mb-3">
        Names for the teams this stable forms: robots 1+2, 3+4 … in 2v2; 1–3, 4–6, 7–9 in 3v3. A team that already exists keeps its name.
      </p>
      {error && <FieldError>{error}</FieldError>}
      {rows.length === 0 ? (
        <p className="text-sm text-secondary">No teams yet.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-secondary border-b border-white/10">
                  <th scope="col" className="py-2 pr-3 font-medium">Team</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Size</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Robots</th>
                  <th scope="col" className="py-2 pr-3 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.size}-${row.index}`} className="border-b border-white/5">
                    <td className="py-1 pr-3 min-w-48">{nameInput(row)}</td>
                    <td className="py-1 pr-3">{row.size}v{row.size}</td>
                    <td className="py-1 pr-3">{membersText(row)}</td>
                    <td className="py-1 pr-3">{teamStateText(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="md:hidden" open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)}>
            <summary className={`flex items-center min-h-11 cursor-pointer text-sm text-white ${FOCUS_RING}`}>{teamsSummary(rows)}</summary>
            <ul className="mt-2 space-y-3">
              {rows.map((row) => (
                <li key={`${row.size}-${row.index}`} className="rounded-md border border-white/10 p-3 text-sm space-y-1">
                  {nameInput(row)}
                  <p className="text-secondary">{row.size}v{row.size} · {membersText(row)}</p>
                  <p>{teamStateText(row)}</p>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <p className="mt-3 text-xs text-secondary">Robot 11 is in no team; robots 10 and 11 are in no 3v3 team.</p>
    </Card>
  );
}
