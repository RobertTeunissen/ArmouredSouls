/**
 * The stable detail panel (a slide-over): the same content wherever it is
 * opened — the Players list, the stable search, Search Analytics, Practice
 * Arena, Tournaments (`?user=`). Players get the password reset; Automatons
 * link to their Editor; generated stables are read-only.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING, AdminSlideOver, PanelError, PanelSkeleton } from '../shared';
import { ApiError } from '../../../utils/ApiError';
import { isAbortError } from '../../../utils/abort';
import { getPlayerDetail, type PlayerDetail, type PlayerDetailRobot, type PlayerSegment } from '../../../utils/adminPlayersApi';
import {
  SEGMENT_LABELS,
  capitalize,
  creditsText,
  displayName,
  lastSeenText,
  loadoutText,
  shortDateText,
  stableBattlesHref,
} from '../../../utils/adminPlayersFormat';
import { EVENT_LABELS } from '../automatons/automatonText';
import { BalanceTrend } from './BalanceTrend';
import { PasswordResetForm } from './PasswordResetForm';
import { IssueTag } from './PlayersTable';
import { StableKindTag } from './StableSearch';

export interface PlayerDetailPanelProps {
  userId: number | null;
  lowBalanceThreshold: number;
  onClose: () => void;
}

const SEGMENT_TONE: Readonly<Record<PlayerSegment, string>> = {
  active: 'bg-success/15 text-success',
  inactive: 'bg-warning/15 text-warning',
  dormant: 'bg-white/10 text-secondary',
};

const ROBOT_MODES = ['league_1v1', 'koth', 'grand_melee'] as const;
const TEAM_MODES = ['league_2v2', 'league_3v3', 'tag_team'] as const;
const LINK = `inline-flex min-h-11 items-center rounded-md bg-surface-elevated px-3 text-sm text-primary hover:bg-white/10 ${ADMIN_FOCUS_RING}`;

function onboardingText(detail: PlayerDetail): string {
  if (detail.onboarding.completed) return 'Completed';
  if (detail.onboarding.skipped) return 'Skipped';
  return `Step ${detail.onboarding.currentStep}`;
}

function Fact({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }): ReactNode {
  return (
    <div className="flex flex-col-reverse rounded-md bg-surface-elevated px-3 py-2">
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className={`text-sm font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}

function Heading({ children }: { children: ReactNode }): ReactNode {
  return <h3 className="mb-2 text-sm font-semibold text-white">{children}</h3>;
}

function RobotCard({ robot }: { robot: PlayerDetailRobot }): ReactNode {
  const weapons = [robot.mainWeapon, robot.offhandWeapon].filter(Boolean).join(' + ') || 'No weapon';
  return (
    <li className="rounded-md bg-surface-elevated p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to={`/robots/${robot.id}`} className={`font-semibold text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
          {robot.name} <span aria-hidden="true">↗</span>
        </Link>
        <span className={`rounded-full px-2 py-0.5 text-xs ${robot.battleReady ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
          {robot.battleReady ? 'Battle ready' : 'Not ready'}
        </span>
      </div>
      <p className="mt-1 text-xs text-secondary">
        ELO {robot.elo.toLocaleString('en-US')} · HP {robot.hpPercent}% · {weapons} · {loadoutText(robot.loadout)} · {capitalize(robot.stance)} · W/L/D {robot.wins}/{robot.losses}/{robot.draws}
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {ROBOT_MODES.map((mode) => (
          <div key={mode} className="flex flex-col-reverse rounded bg-surface px-2 py-1">
            <dt className="text-[11px] text-secondary">{EVENT_LABELS[mode] ?? mode}</dt>
            <dd className="text-xs text-white">{robot.tiers[mode] ? capitalize(robot.tiers[mode] as string) : '—'}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-secondary">
        {robot.subscriptions.length > 0 ? `Subscribed: ${robot.subscriptions.map((s) => EVENT_LABELS[s] ?? capitalize(s)).join(', ')}` : 'No event subscriptions'}
      </p>
    </li>
  );
}

function DetailBody({ detail, lowBalanceThreshold }: { detail: PlayerDetail; lowBalanceThreshold: number }): ReactNode {
  const isPlayer = detail.stableKind === 'human';
  const lowBalance = detail.currency < lowBalanceThreshold;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-secondary">@{detail.username} · #{detail.id} · joined {shortDateText(detail.createdAt)}{detail.role === 'admin' ? ' · admin' : ''}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StableKindTag kind={detail.stableKind} />
          {detail.segment && <span className={`rounded-full px-2 py-0.5 text-xs ${SEGMENT_TONE[detail.segment]}`}>{SEGMENT_LABELS[detail.segment]}</span>}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Balance" value={creditsText(detail.currency)} tone={lowBalance ? 'text-error' : 'text-white'} />
        <Fact label="Last login" value={isPlayer ? lastSeenText(detail.lastLoginAt, new Date()) : 'Never logs in'} />
        <Fact label="Onboarding" value={isPlayer ? onboardingText(detail) : '—'} />
        <Fact label="Battles (season)" value={`${detail.battles.toLocaleString('en-US')}${detail.winRate === null ? '' : ` · ${detail.winRate}% won`}`} />
      </dl>

      <section>
        <Heading>Balance, last 10 cycles</Heading>
        <BalanceTrend cashflow={detail.cashflow} threshold={lowBalanceThreshold} />
      </section>

      {detail.issues.length > 0 && (
        <section>
          <Heading>Issues</Heading>
          <ul className="flex flex-wrap gap-2">{detail.issues.map((issue) => <li key={issue.code}><IssueTag issue={issue} /></li>)}</ul>
        </section>
      )}

      <section>
        <Heading>Robots ({detail.robots.length})</Heading>
        {detail.robots.length === 0 ? <p className="text-sm text-secondary">No robots.</p> : (
          <ul className="space-y-2">{detail.robots.map((robot) => <RobotCard key={robot.id} robot={robot} />)}</ul>
        )}
      </section>

      {detail.teams.length > 0 && (
        <section>
          <Heading>Teams ({detail.teams.length})</Heading>
          <ul className="space-y-1 text-sm">
            {detail.teams.map((team) => (
              <li key={team.id} className="flex flex-wrap justify-between gap-2 rounded-md bg-surface-elevated px-3 py-2">
                <span className="text-white">{team.name} <span className="text-secondary">· {team.size}v{team.size}</span></span>
                <span className="text-xs text-secondary">
                  {TEAM_MODES.filter((mode) => team.tiers[mode]).map((mode) => `${EVENT_LABELS[mode] ?? mode} ${capitalize(team.tiers[mode] as string)}`).join(' · ') || 'No tier yet'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <Heading>Facilities ({detail.facilities.length})</Heading>
        {detail.facilities.length === 0 ? <p className="text-sm text-secondary">None bought.</p> : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {detail.facilities.map((f) => (
              <li key={f.type} className="flex justify-between rounded-md bg-surface-elevated px-3 py-2 text-sm">
                <span className="text-white">{capitalize(f.type)}</span>
                <span className="text-secondary">Lv {f.level}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <Heading>Look further</Heading>
        <div className="flex flex-wrap gap-2">
          <Link to={stableBattlesHref(detail)} className={LINK}>Battles of this stable <span aria-hidden="true">&nbsp;↗</span></Link>
          <Link to={`/stables/${detail.id}`} className={LINK}>Stable page <span aria-hidden="true">&nbsp;↗</span></Link>
          {detail.automatonKey && (
            <Link to={`/admin/automatons?tab=editor&stable=${encodeURIComponent(detail.automatonKey)}`} className={LINK}>Open in Editor <span aria-hidden="true">&nbsp;↗</span></Link>
          )}
        </div>
      </section>

      {isPlayer ? (
        <div className="border-t border-white/10 pt-5"><PasswordResetForm userId={detail.id} username={detail.username} /></div>
      ) : (
        <p className="border-t border-white/10 pt-5 text-xs text-secondary">
          {detail.stableKind === 'automaton' ? 'Automatons' : 'Generated stables'} never log in, so there is no password to reset.
        </p>
      )}
    </div>
  );
}

export function PlayerDetailPanel({ userId, lowBalanceThreshold, onClose }: PlayerDetailPanelProps): ReactNode {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    getPlayerDetail(userId, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setDetail(value); })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.statusCode === 404 && 'This stable no longer exists.') || (err instanceof ApiError && err.message) || 'The stable could not be loaded.');
      });
    return () => controller.abort();
  }, [userId, token]);

  const title = detail && detail.id === userId ? displayName(detail) : 'Stable';
  return (
    <AdminSlideOver open={userId !== null} onClose={onClose} title={title} width="xl">
      {error ? <PanelError message={error} onRetry={() => setToken((t) => t + 1)} />
        : detail && detail.id === userId ? <DetailBody detail={detail} lowBalanceThreshold={lowBalanceThreshold} />
          : <PanelSkeleton rows={8} />}
    </AdminSlideOver>
  );
}
