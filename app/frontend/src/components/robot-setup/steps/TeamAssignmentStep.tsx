/**
 * TeamAssignmentStep — optional wizard step, shown only to stables with two
 * or more robots. Creates a 2v2 or 3v3 team with this robot and teammates the
 * player picks. Placed before Events so the team events can be entered next.
 *
 * Requirements: 5.6, 6.1, 10.5
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyTeamBattles, registerTeamBattle, type TeamBattle } from '../../../utils/teamBattleApi';
import { useRobotStore } from '../../../stores';
import { ERROR_NOTICE, PANEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../styles';
import type { StepProps } from '../types';

const TEAM_NAME_MIN = 3;
const TEAM_NAME_MAX = 32;

function SizeChip({ size, pressed, disabled, onClick }: { size: 2 | 3; pressed: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-medium transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? 'border-white bg-primary text-white' : 'border-transparent bg-surface-elevated text-secondary hover:text-white'
      }`}
    >
      {pressed && <span aria-hidden="true">✓</span>}
      {size}v{size}
    </button>
  );
}

function TeamAssignmentStep({ robotId, onComplete, onSkip }: StepProps) {
  const robots = useRobotStore((state) => state.robots);
  const fetchRobots = useRobotStore((state) => state.fetchRobots);
  const [teams, setTeams] = useState<TeamBattle[]>([]);
  const [teamName, setTeamName] = useState('');
  const [teamSize, setTeamSize] = useState<2 | 3>(2);
  const [teammates, setTeammates] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void fetchRobots(); }, [fetchRobots]);
  useEffect(() => {
    const controller = new AbortController();
    getMyTeamBattles(undefined, controller.signal).then(setTeams).catch(() => { /* the team list is a hint only */ });
    return () => controller.abort();
  }, []);

  const others = useMemo(() => robots.filter((r) => r.id !== robotId), [robots, robotId]);
  const memberOf = teams.filter((t) => t.members.some((m) => m.robotId === robotId));

  // Default teammates: the first other robots, re-picked when the size or roster changes.
  useEffect(() => {
    setTeammates(others.slice(0, teamSize - 1).map((r) => r.id));
  }, [others, teamSize]);

  const name = teamName.trim();
  const nameValid = name.length >= TEAM_NAME_MIN && name.length <= TEAM_NAME_MAX;
  const teammatesValid = teammates.length === teamSize - 1 && new Set(teammates).size === teammates.length;

  const setTeammate = (slot: number, id: number): void => {
    setTeammates((current) => current.map((value, i) => (i === slot ? id : value)));
  };

  const createTeam = async (): Promise<void> => {
    if (!nameValid || !teammatesValid) return;
    setBusy(true);
    setError(null);
    try {
      await registerTeamBattle([robotId, ...teammates], name, teamSize);
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to create the team.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={PANEL} aria-labelledby="team-step-heading">
      <h2 id="team-step-heading" className="text-lg font-semibold">Form a team</h2>
      <p className="mt-1 text-sm text-secondary">
        Optional. A team can enter 2v2 League, 3v3 League, Tag Team and the team tournaments. Solo events need no team.
      </p>

      {memberOf.length > 0 && (
        <p className="mt-3 text-sm text-secondary">
          Already on {memberOf.map((t) => t.teamName).join(', ')}.{' '}
          <Link to="/team-battles" className="text-primary hover:underline">Manage teams</Link>
        </p>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="new-team-name" className="mb-1 block text-sm">Team name</label>
          <input
            id="new-team-name"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            maxLength={TEAM_NAME_MAX}
            aria-describedby="new-team-name-help"
            className="min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-elevated px-3 text-white focus:border-primary focus:outline-none"
          />
          <p id="new-team-name-help" className="mt-1 text-xs text-secondary">{TEAM_NAME_MIN}–{TEAM_NAME_MAX} characters.</p>
        </div>

        <div>
          <p id="new-team-size-label" className="mb-1 text-sm">Team size</p>
          <div className="flex gap-2" role="group" aria-labelledby="new-team-size-label">
            <SizeChip size={2} pressed={teamSize === 2} disabled={false} onClick={() => setTeamSize(2)} />
            <SizeChip size={3} pressed={teamSize === 3} disabled={others.length < 2} onClick={() => setTeamSize(3)} />
          </div>
          {others.length < 2 && <p className="mt-1 text-xs text-secondary">3v3 needs three robots in your stable.</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teammates.map((selected, slot) => (
            <div key={slot}>
              <label htmlFor={`teammate-${slot}`} className="mb-1 block text-sm">Teammate {slot + 1}</label>
              <select
                id={`teammate-${slot}`}
                value={selected}
                onChange={(e) => setTeammate(slot, Number(e.target.value))}
                className="min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-elevated px-3 text-white focus:border-primary focus:outline-none"
              >
                {others
                  .filter((r) => r.id === selected || !teammates.includes(r.id))
                  .map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          ))}
        </div>

        {error && <p className={ERROR_NOTICE} role="alert">{error}</p>}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {onSkip && <button type="button" onClick={onSkip} disabled={busy} className={SECONDARY_BUTTON}>Skip</button>}
        <button type="button" onClick={() => void createTeam()} disabled={busy || !nameValid || !teammatesValid} className={PRIMARY_BUTTON}>
          {busy ? 'Creating…' : `Create ${teamSize}v${teamSize} team`}
        </button>
      </div>
    </section>
  );
}

export default TeamAssignmentStep;
