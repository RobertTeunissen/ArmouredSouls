import React from 'react';
import { useNavigate } from 'react-router-dom';
import CompactBattleCard from './CompactBattleCard';
import { BattleHistory, getBattleOutcome, getELOChange, getBattleReward } from '../utils/matchmakingApi';

interface RecentBattlesProps {
  battles: BattleHistory[];
  robotId?: number; // Optional: if provided, will determine which robot is "mine"
}

const RecentBattles: React.FC<RecentBattlesProps> = ({ battles, robotId }) => {
  const navigate = useNavigate();

  if (battles.length === 0) {
    return (
      <div className="bg-[#252b38] rounded-lg p-6 text-center">
        <p className="text-[#8b949e]">No recent battles</p>
      </div>
    );
  }

  const getMatchData = (battle: BattleHistory) => {
    // Determine which robot is "mine" based on robotId or userId
    let myRobot, opponent, myRobotId;
    
    if (robotId) {
      // If robotId is provided, use it to determine which side
      const isRobot1 = battle.robot1Id === robotId;
      myRobot = isRobot1 ? battle.robot1 : battle.robot2;
      opponent = isRobot1 ? battle.robot2 : battle.robot1;
      myRobotId = robotId;
    } else {
      // For tag team battles, check team membership
      if (battle.battleType === 'tag_team') {
        // Default to robot1 as "mine" if no robotId specified
        myRobot = battle.robot1;
        opponent = battle.robot2;
        myRobotId = battle.robot1Id;
      } else {
        // Default to robot1 as "mine"
        myRobot = battle.robot1;
        opponent = battle.robot2;
        myRobotId = battle.robot1Id;
      }
    }
    
    const outcome = getBattleOutcome(battle, myRobotId);
    const eloChange = getELOChange(battle, myRobotId);
    
    return { myRobot, opponent, outcome, eloChange, myRobotId };
  };

  return (
    <div className="bg-[#252b38] rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-base font-semibold text-[#e6edf3]">Recent Battles</h3>
      </div>
      
      <div className="p-2">
        {battles.map((battle) => {
          const { myRobot, opponent, outcome, eloChange, myRobotId } = getMatchData(battle);
          const reward = getBattleReward(battle, myRobotId);

          return (
            <CompactBattleCard
              key={battle.id}
              battle={battle}
              myRobot={myRobot}
              opponent={opponent}
              outcome={outcome}
              eloChange={eloChange}
              myRobotId={myRobotId}
              reward={reward}
              onClick={() => navigate(`/battle/${battle.id}`)}
            />
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-700 text-center">
        <button
          onClick={() => navigate('/battle-history')}
          className="text-[#58a6ff] hover:text-[#58a6ff]/80 font-medium transition-colors"
        >
          View All Battles →
        </button>
      </div>
    </div>
  );
};

export default RecentBattles;
