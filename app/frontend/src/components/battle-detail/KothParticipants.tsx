import type { KothParticipantsProps } from './types';

export function KothParticipants({ battleLog, userId }: KothParticipantsProps) {
  if (battleLog.battleType !== 'koth' || !battleLog.kothParticipants) return null;

  return (
    <div className="bg-orange-900/20 border border-orange-600 rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold text-orange-400 mb-3">⛰️ King of the Hill Results</h3>
      <div className="space-y-2">
        {battleLog.kothParticipants.map((p) => {
          const isCurrentUser = p.ownerId === userId;
          const placementEmoji = p.placement === 1 ? '🥇' : p.placement === 2 ? '🥈' : p.placement === 3 ? '🥉' : `#${p.placement}`;
          const bgColor = isCurrentUser ? 'bg-orange-900/30 border border-orange-500/50' : 'bg-background';

          return (
            <div key={p.robotId} className={`${bgColor} rounded-lg p-2 flex items-center gap-3`}>
              <div className="text-xl w-8 text-center flex-shrink-0">{placementEmoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${isCurrentUser ? 'text-orange-300' : 'text-white'}`}>{p.robotName}</span>
                  <span className="text-secondary text-xs">({p.owner})</span>
                  {p.destroyed && <span className="text-red-400 text-xs">💀 Destroyed</span>}
                </div>
                <div className="flex gap-3 text-xs text-secondary mt-1">
                  <span>Zone Score: <span className="text-orange-400 font-medium">{p.zoneScore}</span></span>
                  <span>Zone Time: <span className="text-cyan-400 font-medium">{Number(p.zoneTime).toFixed(1)}s</span></span>
                  <span>Kills: <span className="text-red-400 font-medium">{p.kills}</span></span>
                  <span>Damage: <span className="text-yellow-400 font-medium">{p.damageDealt}</span></span>
                </div>
              </div>
              <div className="text-right flex-shrink-0 text-xs space-y-0.5">
                <div className="text-success font-medium">₡{p.credits.toLocaleString()}</div>
                {p.fame > 0 && <div className="text-warning">+{p.fame} fame</div>}
                {p.prestige > 0 && <div className="text-purple-400">+{p.prestige} prestige</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
