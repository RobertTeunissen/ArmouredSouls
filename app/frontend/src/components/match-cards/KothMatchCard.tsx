import { ScheduledMatch, formatDateTime } from '../../utils/matchmakingApi';
import { getModeConfig } from '../../utils/battleModeConfig';

interface KothMatchCardProps {
  match: ScheduledMatch;
  myUserId?: number;
}

function KothMatchCard({ match, myUserId }: KothMatchCardProps) {
  const modeConfig = getModeConfig('koth');
  const kothLabel = 'King of the Hill';
  const participants = match.kothParticipants || [];
  const participantCount = match.kothParticipantCount ?? participants.length;

  // Find the current user's robot among participants
  const myRobot = myUserId ? participants.find(p => p.userId === myUserId) : undefined;

  return (
    <div
      className={`
        bg-[#252b38] border border-white/10 rounded-lg p-2 mb-1.5
        border-l-4 ${modeConfig.borderColor}
        hover:bg-[#1a1f29] hover:border-[#58a6ff]/50
        transition-all duration-150 ease-out
        hover:-translate-y-0.5
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-shrink-0 w-6 text-center text-base">{modeConfig.icon}</div>
        <div className="flex-shrink-0 w-16">
          <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-primary-dark/20 text-primary">
            PENDING
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
              FFA
            </span>
            <div className="text-xs text-[#8b949e]">
              {kothLabel}
            </div>
          </div>
          <div className="font-medium text-xs truncate">
            {myRobot ? (
              <>
                <span className="text-[#58a6ff]">{myRobot.name}</span>
                <span className="text-[#8b949e] mx-1.5">• {participantCount} robots</span>
              </>
            ) : participantCount > 0 ? (
              <span className="text-[#8b949e]">{participantCount} robots</span>
            ) : null}
          </div>
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
            <span className="text-base">{modeConfig.icon}</span>
            <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-dark/20 text-primary">
              PENDING
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${modeConfig.badgeColor}`}>
              FFA
            </span>
          </div>
          <div className="text-xs text-[#8b949e]">
            {formatDateTime(match.scheduledFor)}
          </div>
        </div>
        <div className="text-xs text-[#8b949e] mb-1.5">{kothLabel}</div>
        <div className="mb-1.5">
          {myRobot ? (
            <div className="text-sm font-medium">
              <span className="text-[#58a6ff]">{myRobot.name}</span>
              <span className="text-[#8b949e] mx-1.5">• {participantCount} robots</span>
            </div>
          ) : participantCount > 0 ? (
            <div className="text-sm font-medium text-[#8b949e]">{participantCount} robots</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default KothMatchCard;
