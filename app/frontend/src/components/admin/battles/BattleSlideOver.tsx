/**
 * Admin check of one battle: export actions, result and context, participants,
 * payout check and the combat log. Nothing here repeats the player report,
 * which the header links to.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminSlideOver, ADMIN_FOCUS_RING, PanelError } from '../shared';
import { useBattleDetail } from '../../../hooks/useAdminBattles';
import { copyBattleExport, getBattleExportJson } from '../../../utils/adminBattlesApi';
import { downloadJson } from '../../../utils/download';
import { BattleParticipants } from './BattleParticipants';
import { BattlePayoutCheck } from './BattlePayoutCheck';
import { BattleCombatLog } from './BattleCombatLog';
import type { BattleDetail } from './types';
import {
  endedByLabel,
  formatBattleDateTime,
  formatBattleDuration,
  formatBytes,
  formatShortDate,
  modeDetail,
  modeLabel,
  resultLabel,
} from '../../../utils/adminBattlesFormat';

type Notice = { tone: 'success' | 'error'; text: string } | null;

function resultHeadline(b: BattleDetail): { text: string; tone: string } {
  if (b.result === 'bye') return { text: 'Bye · no opponent', tone: 'text-warning' };
  if (b.result === 'forfeit') return { text: 'Forfeit', tone: 'text-warning' };
  if (b.result === 'draw') return { text: 'Draw', tone: 'text-secondary' };
  const side = b.sides.find((s) => s.isWinner);
  if (side) return { text: `${side.label} won`, tone: 'text-success' };
  const robot = b.participants.find((p) => p.robotId === b.winnerRobotId);
  return { text: robot ? `${robot.robotName} won` : resultLabel(b.result), tone: 'text-success' };
}

function Fact({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-tertiary">{label}</dt>
      <dd className="text-sm text-white">{value}</dd>
    </div>
  );
}

function ResultCard({ battle }: { battle: BattleDetail }): React.ReactElement {
  const headline = resultHeadline(battle);
  const fought = battle.result !== 'bye' && battle.result !== 'forfeit';
  return (
    <section aria-label="Result" className="rounded-lg bg-surface-elevated p-4">
      <p className="text-sm">
        <span className={`text-base font-bold ${headline.tone}`}>{headline.text}</span>
        {fought && (
          <span className="text-secondary">
            {battle.endedBy && ` · ${endedByLabel(battle.endedBy)}`} · {formatBattleDuration(battle.durationSeconds)}
            <span className="text-tertiary"> (limit {formatBattleDuration(battle.timeLimitSeconds)})</span>
          </span>
        )}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Fact label="Cycle" value={battle.cycleNumber !== null ? String(battle.cycleNumber) : '—'} />
        {battle.tournament ? (
          <Fact label="Tournament" value={battle.tournament.round !== null ? `${battle.tournament.name} · R${battle.tournament.round}` : battle.tournament.name} />
        ) : (
          <Fact label="League instance" value={battle.leagueInstanceId ?? battle.leagueType} />
        )}
        <Fact
          label={battle.tournamentMatchId !== null ? 'Bracket match' : 'Scheduled match'}
          value={battle.tournamentMatchId !== null ? `#${battle.tournamentMatchId}` : battle.scheduledMatchId !== null ? `#${battle.scheduledMatchId}` : '—'}
        />
        <Fact
          label="Combat log"
          value={battle.combatLog.available ? `Kept until ${formatShortDate(battle.combatLog.removesOn)}` : `Removed ${formatShortDate(battle.combatLog.removesOn)}`}
        />
      </dl>
    </section>
  );
}

function ExportActions({ battleId }: { battleId: number }): React.ReactElement {
  const [busy, setBusy] = useState<'copy' | 'json' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const copy = async (): Promise<void> => {
    setBusy('copy');
    setNotice(null);
    try {
      const bytes = await copyBattleExport(battleId);
      setNotice({ tone: 'success', text: `Copied the whole battle for analysis (${formatBytes(bytes)} of text).` });
    } catch {
      setNotice({ tone: 'error', text: 'Could not copy the battle. Try Download JSON instead.' });
    } finally {
      setBusy(null);
    }
  };

  const download = async (): Promise<void> => {
    setBusy('json');
    setNotice(null);
    try {
      downloadJson(`battle-${battleId}.json`, await getBattleExportJson(battleId));
      setNotice({ tone: 'success', text: `Downloaded battle-${battleId}.json.` });
    } catch {
      setNotice({ tone: 'error', text: 'Could not download the battle.' });
    } finally {
      setBusy(null);
    }
  };

  const base = `min-h-11 rounded-md px-4 text-sm font-semibold disabled:opacity-60 ${ADMIN_FOCUS_RING}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} disabled={busy !== null} className={`${base} bg-primary text-background hover:bg-primary-light`}>
          {busy === 'copy' ? 'Copying…' : 'Copy for analysis'}
        </button>
        <button type="button" onClick={download} disabled={busy !== null} className={`${base} bg-surface-elevated text-white hover:bg-white/10`}>
          {busy === 'json' ? 'Preparing…' : 'Download JSON'}
        </button>
        <Link
          to={`/battle/${battleId}`}
          className={`${base} inline-flex items-center border border-primary/60 font-normal text-primary hover:bg-primary/10`}
        >
          Open player report <span aria-hidden="true" className="ml-1">↗</span>
        </Link>
      </div>
      <div aria-live="polite">
        {notice && (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${
              notice.tone === 'success' ? 'border-success/40 bg-success/10 text-success' : 'border-error/40 bg-error/10 text-error'
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>
    </div>
  );
}

export interface BattleSlideOverProps {
  battleId: number | null;
  onClose: () => void;
}

export function BattleSlideOver({ battleId, onClose }: BattleSlideOverProps): React.ReactElement | null {
  const detail = useBattleDetail(battleId);
  const battle = detail.data && detail.data.id === battleId ? detail.data : null;

  return (
    <AdminSlideOver open={battleId !== null} onClose={onClose} title={battleId !== null ? `Battle #${battleId}` : 'Battle'} width="3xl">
      {battleId !== null && (
        <div className="space-y-6" data-testid="battle-slide-over">
          {battle && (
            <p className="-mt-2 text-sm text-secondary">
              {modeLabel(battle.battleType)} · {modeDetail({ ...battle, participantCount: battle.participants.length })} · {formatBattleDateTime(battle.createdAt)}
            </p>
          )}
          <ExportActions battleId={battleId} />
          {detail.error && <PanelError message={detail.error} onRetry={detail.reload} />}
          {!battle && detail.loading && <p className="text-sm text-secondary" role="status">Loading the battle…</p>}
          {battle && (
            <>
              <ResultCard battle={battle} />
              <section aria-labelledby="participants-heading" className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 id="participants-heading" className="text-base font-semibold text-white">Participants</h3>
                  <span className="text-xs text-secondary">As recorded on the battle</span>
                </div>
                <BattleParticipants battle={battle} />
              </section>
              <BattlePayoutCheck payout={battle.payout} />
              <BattleCombatLog battleId={battle.id} status={battle.combatLog} />
            </>
          )}
        </div>
      )}
    </AdminSlideOver>
  );
}
