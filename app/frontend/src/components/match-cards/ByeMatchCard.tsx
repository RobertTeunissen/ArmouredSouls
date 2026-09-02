import { formatDateTime, ScheduledMatch } from '../../utils/matchmakingApi';
import { getModeConfig } from '../../utils/battleModeConfig';
import type { ByeCardSubject } from './bye-match-data';

interface ByeMatchCardProps {
  match: ScheduledMatch;
  subject: ByeCardSubject;
}

function getSubjectLabel(subject: ByeCardSubject): string {
  if (subject.kind !== 'team') return subject.name;
  if (subject.memberNames.length === 0) return subject.name;
  return `${subject.name} (${subject.memberNames.join(', ')})`;
}

function ByeMatchCard({ match, subject }: ByeMatchCardProps) {
  const modeConfig = getModeConfig(match.matchType);
  const isTournament = match.matchType?.startsWith('tournament_') === true;
  const round = match.tournamentRound ?? match.currentRound;
  const roundLabel = isTournament && round != null && match.maxRounds != null
    ? ` • Round ${round}/${match.maxRounds}`
    : '';
  const tournamentLabel = isTournament && match.tournamentName
    ? `${match.tournamentName}${roundLabel}`
    : modeConfig.label;
  const rewardStatus = match.byeRewardStatus;
  const rewardLabel = match.byeRewardCredits != null
    ? rewardStatus === 'awarded'
      ? `Awarded bye reward: ₡${match.byeRewardCredits.toLocaleString()}`
      : `Expected bye reward: ₡${match.byeRewardCredits.toLocaleString()}`
    : rewardStatus === 'pending'
      ? 'Bye reward pending'
      : null;

  return (
    <div
      className={`
        bg-[#252b38] border border-white/10 rounded-lg p-3 mb-1.5 min-h-[44px]
        border-l-4 ${modeConfig.borderColor}
        transition-all duration-150 ease-out
      `}
    >
      <div className="hidden lg:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">{modeConfig.icon}</div>
        <div className="flex-shrink-0 w-16">
          <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-yellow-500/20 text-warning">
            BYE
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
              {modeConfig.label}
            </span>
            <span className="text-xs text-[#d29922] truncate">{tournamentLabel}</span>
          </div>
          <div className="font-medium text-xs truncate text-[#58a6ff]">{getSubjectLabel(subject)}</div>
        </div>
        <div className="flex-shrink-0 w-44 text-right text-xs text-[#8b949e]">
          <div>No opponent — walkover</div>
          <div>{formatDateTime(match.scheduledFor)}</div>
        </div>
        {rewardLabel && (
          <div className="flex-shrink-0 w-36 text-right text-xs font-medium text-[#e6edf3]">
            {rewardLabel}
          </div>
        )}
      </div>

      <div className="lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="text-base">{modeConfig.icon}</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-warning">BYE</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
              {modeConfig.label}
            </span>
          </div>
          <span className="text-xs text-[#8b949e] whitespace-nowrap">{formatDateTime(match.scheduledFor)}</span>
        </div>
        <div className="text-xs text-[#d29922] mb-1.5 break-words">{tournamentLabel}</div>
        <div className="text-sm font-medium text-[#58a6ff] break-words mb-1">{getSubjectLabel(subject)}</div>
        <div className="text-xs text-[#8b949e]">No opponent — walkover</div>
        {rewardLabel && <div className="text-xs font-medium text-[#e6edf3] mt-1 break-words">{rewardLabel}</div>}
      </div>
    </div>
  );
}

export default ByeMatchCard;
