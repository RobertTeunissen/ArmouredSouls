import { ScheduledMatch, formatDateTime } from '../../utils/matchmakingApi';

interface KothMatchCardProps {
  match: ScheduledMatch;
}

function KothMatchCard({ match }: KothMatchCardProps) {
  const kothLabel = match.kothRotatingZone ? 'KotH — Rotating Zone' : 'King of the Hill';
  const participantText = match.kothParticipantCount ? `${match.kothParticipantCount} robots` : '';

  return (
    <div
      className={`
        bg-[#252b38] border border-white/10 rounded-lg p-2 mb-1.5
        border-l-4 border-l-orange-500
        hover:bg-[#1a1f29] hover:border-[#58a6ff]/50
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">👑</div>
        <div className="flex-shrink-0 w-16">
          <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-primary-dark/20 text-primary">
            PENDING
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-orange-500 mb-0.5">{kothLabel}</div>
          {participantText && (
            <div className="text-xs text-[#8b949e]">{participantText}</div>
          )}
        </div>
        <div className="flex-shrink-0 w-28 text-xs text-[#8b949e]">
          {formatDateTime(match.scheduledFor)}
        </div>
        <div className="flex-shrink-0 w-20"></div>
        <div className="flex-shrink-0 w-6 text-center text-[#58a6ff] text-sm">→</div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">👑</span>
            <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-dark/20 text-primary">
              PENDING
            </div>
          </div>
          <div className="text-xs text-[#8b949e]">
            {formatDateTime(match.scheduledFor)}
          </div>
        </div>
        <div className="text-xs text-orange-500 mb-1.5">{kothLabel}</div>
        {participantText && (
          <div className="text-xs text-[#8b949e]">{participantText}</div>
        )}
      </div>
    </div>
  );
}

export default KothMatchCard;
