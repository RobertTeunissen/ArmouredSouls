import { Link } from 'react-router-dom';
import { formatDuration } from '../../utils/matchmakingApi';
import { getLeagueTierName, getLeagueTierIcon } from '../../utils/matchmakingApi';
import { getTournamentRoundName } from '../../utils/matchmakingApi';
import RobotImage from '../RobotImage';
import type { BattleResultBannerProps } from './types';
import type { BattleLogResponse, BattleLogParticipant } from '../../utils/matchmakingApi';

// ── Helpers ──────────────────────────────────────────────────────────

type Outcome = 'victory' | 'defeat' | 'draw';

function getOutcome(participants: BattleLogParticipant[], isWinner: (p: BattleLogParticipant) => boolean, userId?: number): Outcome {
  const userParticipant = userId ? participants.find(p => p.ownerId === userId) : null;
  if (!userParticipant) return 'draw'; // spectator
  // For KotH, placement 1 = victory
  if (userParticipant.placement !== null && userParticipant.placement !== undefined) {
    return userParticipant.placement === 1 ? 'victory' : 'defeat';
  }
  // For 1v1/tag team
  const hasWinner = participants.some(p => isWinner(p));
  if (!hasWinner) return 'draw';
  return isWinner(userParticipant) ? 'victory' : 'defeat';
}

function isParticipantCheck(participants: BattleLogParticipant[], userId?: number): boolean {
  if (!userId) return false;
  return participants.some(p => p.ownerId === userId);
}

function getTheme(isUserParticipant: boolean, outcome: Outcome) {
  if (!isUserParticipant) {
    return { headingColor: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'border-primary' };
  }
  switch (outcome) {
    case 'victory': return { headingColor: 'text-success', bgClass: 'bg-success/10', borderClass: 'border-success' };
    case 'defeat': return { headingColor: 'text-error', bgClass: 'bg-error/10', borderClass: 'border-error' };
    case 'draw': return { headingColor: 'text-warning', bgClass: 'bg-warning/10', borderClass: 'border-warning' };
  }
}

function getHeading(participants: BattleLogParticipant[], winnerId: number | null, winningTeam: number | null, isUserParticipant: boolean, outcome: Outcome): string {
  if (isUserParticipant) {
    return outcome === 'victory' ? 'Victory' : outcome === 'defeat' ? 'Defeat' : 'Draw';
  }
  // Spectator
  if (winningTeam !== null) {
    // Tag team — show winning stable name
    const teamWinner = participants.find(p => p.team === winningTeam);
    return teamWinner ? `${teamWinner.owner} Wins` : 'Winner';
  }
  if (winnerId) {
    const winner = participants.find(p => p.robotId === winnerId);
    return winner ? `${winner.robotName} Wins` : 'Winner';
  }
  return 'Draw';
}

function getEndMethod(participants: BattleLogParticipant[], winnerId: number | null, winningTeam: number | null, battleType?: string): string | null {
  const hasWinner = winnerId !== null || winningTeam !== null;
  if (!hasWinner && battleType !== 'koth') return 'by Time Limit';
  if (battleType === 'koth') return 'by Zone Score';
  if (battleType === 'tournament') {
    const destroyed = participants.find(p => p.destroyed);
    if (destroyed) return 'by Destruction';
    const yielded = participants.find(p => p.yielded);
    if (yielded) return 'by Yield';
    return 'by HP Tiebreaker';
  }
  const destroyed = participants.find(p => p.destroyed);
  if (destroyed) return 'by Destruction';
  const yielded = participants.find(p => p.yielded);
  if (yielded) return 'by Yield';
  return 'by Time Limit';
}

function getPlacementColor(placement: number): string {
  if (placement === 1) return 'text-success';
  if (placement <= 3) return 'text-warning';
  return 'text-secondary';
}

function formatPlacement(placement: number): string {
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${placement}${suffixes[placement] || 'th'}`;
}

// ── Battle Context Line ──────────────────────────────────────────────

function BattleContextLine({ battleLog }: { battleLog: BattleLogResponse }) {
  const duration = formatDuration(battleLog.duration);

  if (battleLog.battleType === 'tag_team') {
    return <span><Link to="/tag-teams/standings" className="text-primary hover:text-white transition-colors">🤝 Tag Team Battle</Link>{` • Duration: ${duration}`}</span>;
  }
  if (battleLog.battleType === 'koth') {
    const count = battleLog.participants?.length || battleLog.kothParticipants?.length || 0;
    return <span><Link to="/koth-standings" className="text-primary hover:text-white transition-colors">⛰️ King of the Hill</Link>{` • ${count} Participants • Duration: ${duration}`}</span>;
  }
  if (battleLog.battleType === 'tournament' || battleLog.battleLog.isTournament) {
    const round = battleLog.battleLog.round;
    const maxRounds = battleLog.battleLog.maxRounds;
    const roundText = round && maxRounds ? getTournamentRoundName(round, maxRounds) : `Round ${round || '?'}/${maxRounds || '?'}`;
    const finals = battleLog.battleLog.isFinals ? ' (Finals)' : '';
    const link = battleLog.tournamentId ? `/tournaments/${battleLog.tournamentId}` : '/tournaments';
    return <span><Link to={link} className="text-primary hover:text-white transition-colors">🏆 Tournament {roundText}{finals}</Link>{` • Duration: ${duration}`}</span>;
  }
  const tierIcon = getLeagueTierIcon(battleLog.leagueType);
  const tierName = getLeagueTierName(battleLog.leagueType);
  return <span><Link to={`/league-standings?tier=${battleLog.leagueType}`} className="text-primary hover:text-white transition-colors">{tierIcon} {tierName} League</Link>{` • Duration: ${duration}`}</span>;
}

// ── Participant Card (unified — used for all battle types) ───────────

function ParticipantCard({ p, isLoser, showPlacement }: {
  p: BattleLogParticipant;
  isLoser: boolean;
  showPlacement: boolean;
}) {
  return (
    <div className={`flex flex-col items-center ${isLoser ? 'opacity-50' : ''}`}>
      <Link to={`/robots/${p.robotId}`}>
        <RobotImage
          imageUrl={p.imageUrl}
          robotName={p.robotName}
          size={showPlacement && p.placement === 1 ? 'medium' : showPlacement ? 'small' : 'medium'}
          className="hover:ring-2 hover:ring-primary rounded-lg transition-all duration-150"
        />
      </Link>
      <Link to={`/robots/${p.robotId}`} className="text-sm text-primary hover:text-white mt-1 transition-colors">
        {p.robotName}
      </Link>
      <Link to={`/stables/${p.ownerId}`} className="text-xs text-secondary hover:text-primary transition-colors">
        {p.owner}
      </Link>
      {showPlacement && p.placement != null && (
        <span className={`text-xs font-bold ${getPlacementColor(p.placement)}`}>
          {formatPlacement(p.placement)}
        </span>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function BattleResultBanner({ battleLog, userId, isMobile }: BattleResultBannerProps) {
  const participants = battleLog.participants ?? [];

  // Fallback for old battles without participants array
  if (participants.length === 0) {
    return <LegacyBattleResultBanner battleLog={battleLog} userId={userId} />;
  }

  const winnerId = (() => {
    // For KotH, winner is the participant with placement 1
    if (battleLog.battleType === 'koth') {
      const winner = participants.find(p => p.placement === 1);
      return winner?.robotId ?? null;
    }
    // For other types, use the battle's winner field mapped to robot ID
    if (battleLog.winner === 'robot1') return battleLog.robot1?.id ?? null;
    if (battleLog.winner === 'robot2') return battleLog.robot2?.id ?? null;
    return null;
  })();

  // For tag team, winning is by team — all robots on the winning team won
  const winningTeam = (() => {
    if (battleLog.battleType !== 'tag_team') return null;
    if (battleLog.winner === 'robot1') return 1;
    if (battleLog.winner === 'robot2') return 2;
    return null;
  })();

  const isWinner = (p: BattleLogParticipant): boolean => {
    if (winningTeam !== null) return p.team === winningTeam;
    return winnerId !== null && p.robotId === winnerId;
  };

  const userIsParticipant = isParticipantCheck(participants, userId);
  const outcome = getOutcome(participants, isWinner, userId);
  const theme = getTheme(userIsParticipant, outcome);
  const heading = getHeading(participants, winnerId, winningTeam, userIsParticipant, outcome);
  const endMethod = getEndMethod(participants, winnerId, winningTeam, battleLog.battleType);

  const isKoth = battleLog.battleType === 'koth';

  // Participants are already in canonical order (winner first) from the page.

  return (
    <div className={`mb-3 p-3 rounded-lg text-center border-2 ${theme.bgClass} ${theme.borderClass}`}>
      <div className={`text-3xl font-bold mb-1 ${theme.headingColor}`}>{heading}</div>
      {endMethod && <div className={`text-sm font-medium mb-2 ${theme.headingColor} opacity-80`}>{endMethod}</div>}

      {/* Participants — one rendering path for all battle types */}
      {isMobile && !isKoth && participants.length >= 2 ? (
        /* Mobile non-KotH: stack with vs between groups */
        <MobileVsLayout
          participants={participants}
          battleType={battleLog.battleType}
          isWinner={isWinner}
          userIsParticipant={userIsParticipant}
          winnerId={winnerId}
          winningTeam={winningTeam}
          isKoth={false}
        />
      ) : isMobile && isKoth ? (
        /* Mobile KotH: 2-column grid */
        <div className="grid grid-cols-2 gap-3 mt-2 justify-items-center">
          {participants.map(p => (
            <ParticipantCard
              key={p.robotId}
              p={p}
              isLoser={false}
              showPlacement={true}
            />
          ))}
        </div>
      ) : (
        /* Desktop + mobile KotH: flex layout */
        <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
          {participants.map((p, i) => {
            const prevTeam = i > 0 ? participants[i - 1].team : null;
            const showVs = i > 0 && !isKoth && (battleLog.battleType !== 'tag_team' || p.team !== prevTeam);

            return (
              <div key={p.robotId} className="flex items-center gap-4">
                {showVs && <span className="text-secondary text-lg font-bold">vs</span>}
                <ParticipantCard
                  p={p}
                  isLoser={userIsParticipant && (winnerId !== null || winningTeam !== null) && !isWinner(p) && !isKoth}
                  showPlacement={isKoth}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="text-sm text-secondary mt-2">
        <BattleContextLine battleLog={battleLog} />
      </div>
    </div>
  );
}

// ── Mobile vs layout: stacked rows with vs separator ─────────────────

function MobileVsLayout({
  participants,
  battleType,
  isWinner,
  userIsParticipant,
  winnerId,
  winningTeam,
}: {
  participants: BattleLogParticipant[];
  battleType?: string;
  isWinner: (p: BattleLogParticipant) => boolean;
  userIsParticipant: boolean;
  winnerId: number | null;
  winningTeam: number | null;
  isKoth: boolean;
}) {
  // Group by team for tag team, or treat each robot as its own group for 1v1
  const groups: BattleLogParticipant[][] = [];
  if (battleType === 'tag_team') {
    const teams = new Map<number, BattleLogParticipant[]>();
    for (const p of participants) {
      const team = teams.get(p.team) ?? [];
      team.push(p);
      teams.set(p.team, team);
    }
    groups.push(...teams.values());
  } else {
    // 1v1 / tournament: each robot is its own row
    for (const p of participants) groups.push([p]);
  }

  return (
    <div className="flex flex-col items-center gap-2 mt-2">
      {groups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className="text-secondary text-lg font-bold text-center my-1">vs</div>}
          <div className="flex items-center justify-center gap-4">
            {group.map(p => (
              <ParticipantCard
                key={p.robotId}
                p={p}
                isLoser={userIsParticipant && (winnerId !== null || winningTeam !== null) && !isWinner(p)}
                showPlacement={false}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Legacy fallback for old battles without participants[] ────────────

function LegacyBattleResultBanner({ battleLog, userId }: BattleResultBannerProps) {
  const r1 = battleLog.robot1;
  const r2 = battleLog.robot2;
  if (!r1 || !r2) return null;

  const winner = battleLog.winner;
  const isUserParticipant = userId ? (r1.ownerId === userId || r2.ownerId === userId) : false;
  const outcome: Outcome = !winner ? 'draw'
    : (winner === 'robot1' && r1.ownerId === userId) || (winner === 'robot2' && r2.ownerId === userId) ? 'victory' : 'defeat';
  const theme = getTheme(isUserParticipant, outcome);
  const heading = isUserParticipant
    ? (outcome === 'victory' ? 'Victory' : outcome === 'defeat' ? 'Defeat' : 'Draw')
    : (!winner ? 'Draw' : `${(winner === 'robot1' ? r1 : r2).name} Wins`);

  return (
    <div className={`mb-3 p-3 rounded-lg text-center border-2 ${theme.bgClass} ${theme.borderClass}`}>
      <div className={`text-3xl font-bold mb-1 ${theme.headingColor}`}>{heading}</div>
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex flex-col items-center">
          <RobotImage imageUrl={r1.imageUrl ?? null} robotName={r1.name} size="medium" />
          <span className="text-sm text-secondary mt-1">{r1.name}</span>
        </div>
        <span className="text-secondary text-lg font-bold">vs</span>
        <div className="flex flex-col items-center">
          <RobotImage imageUrl={r2.imageUrl ?? null} robotName={r2.name} size="medium" />
          <span className="text-sm text-secondary mt-1">{r2.name}</span>
        </div>
      </div>
      <div className="text-sm text-secondary mt-2">
        <BattleContextLine battleLog={battleLog} />
      </div>
    </div>
  );
}
