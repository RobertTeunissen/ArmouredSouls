import type { PracticeBattleResult } from './types';

export interface SimulationResultBannerProps {
  result: PracticeBattleResult;
  ownedRobotName?: string;
}

export function SimulationResultBanner({ result, ownedRobotName }: SimulationResultBannerProps) {
  const { combatResult, robot1Info, robot2Info } = result;
  const robot1Won = combatResult.robot1FinalHP > combatResult.robot2FinalHP;
  const winnerName = combatResult.isDraw ? null : (robot1Won ? robot1Info.name : robot2Info.name);

  let bannerText = '⚖️ DRAW';
  let bannerBg = 'bg-yellow-900/20 border-yellow-600';
  if (!combatResult.isDraw && ownedRobotName) {
    const playerWon = winnerName === ownedRobotName;
    bannerText = playerWon ? `🏆 ${winnerName} WINS` : `💀 ${winnerName} WINS`;
    bannerBg = playerWon ? 'bg-green-900/20 border-green-600' : 'bg-red-900/20 border-red-600';
  } else if (!combatResult.isDraw) {
    bannerText = `🏆 ${winnerName} WINS`;
    bannerBg = 'bg-green-900/20 border-green-600';
  }

  return (
    <div className={`p-3 rounded-lg text-center border-2 ${bannerBg}`}>
      <div className="text-2xl font-bold mb-1">{bannerText}</div>
      <div className="text-secondary text-sm">
        Simulation • Duration: {combatResult.durationSeconds}s
      </div>
    </div>
  );
}
