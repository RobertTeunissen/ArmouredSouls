/* eslint-disable react-refresh/only-export-components */
/**
 * BattleTypeCard component
 * Displays battle type information including name, description, scheduling,
 * rewards, requirements, and visual illustrations.
 * 
 * Features:
 * - Display battle type name and description
 * - Show scheduling information
 * - Explain rewards and requirements
 * - Include visual illustrations
 * 
 * Requirements: 15.1-15.11
 */

export type BattleType = 'league' | 'tag_team' | 'tournament' | 'koth';

export interface BattleTypeInfo {
  name: string;
  description: string;
  icon: string;
  scheduling: {
    frequency: string;
    cycleTime: string; // UTC time
    cycleName: string;
  };
  requirements: string[];
  rewards: string[];
  features: string[];
  strategicConsiderations: string[];
  minRobotsRequired: number;
}

interface BattleTypeCardProps {
  battleType: BattleType;
  compact?: boolean;
  highlighted?: boolean;
  playerRobotCount?: number;
}

// Battle type configurations
export const BATTLE_TYPE_INFO: Record<BattleType, BattleTypeInfo> = {
  league: {
    name: 'League Battles',
    description: 'Standard competitive matches for ranking and progression',
    icon: '🏆',
    scheduling: {
      frequency: 'Daily',
      cycleTime: '20:00 UTC',
      cycleName: 'League Cycle',
    },
    requirements: [
      'At least 1 robot',
      'Robot must be battle-ready (HP > 0, weapon equipped)',
      'Sufficient credits for potential repairs',
    ],
    rewards: [
      'Credits based on performance',
      'Fame points for victories',
      'League Points (LP) affecting standings',
      'Potential league promotion',
    ],
    features: [
      'Matchmaking based on ELO and league tier',
      'Affects league standings',
      'Primary source of competitive progression',
      'Automatic matching during cycle',
    ],
    strategicConsiderations: [
      'Core battle type for all strategies',
      'Consistent daily participation',
      'Builds ELO and league ranking',
      'Essential for progression',
    ],
    minRobotsRequired: 1,
  },
  tag_team: {
    name: 'Tag Team Battles',
    description: '2v2 team battles requiring multiple robots',
    icon: '🤝',
    scheduling: {
      frequency: 'Daily',
      cycleTime: '12:00 UTC',
      cycleName: 'Tag Team Cycle',
    },
    requirements: [
      'At least 2 robots',
      'Both robots must be battle-ready',
      'Roster Expansion facility required',
    ],
    rewards: [
      'Credits for team victories',
      'Fame points for both robots',
      'Additional battle participation opportunity',
      'Team synergy bonuses',
    ],
    features: [
      'Requires 2+ robot strategy',
      'Different strategic considerations',
      'Team composition matters',
      'Additional daily battles',
    ],
    strategicConsiderations: [
      'Unlocked by 2-3 robot strategies',
      'Increases daily battle participation',
      'Requires managing multiple robots',
      'Team composition affects outcomes',
    ],
    minRobotsRequired: 2,
  },
  tournament: {
    name: 'Tournament Battles',
    description: 'Special competitive events with bracket-style elimination',
    icon: '🥇',
    scheduling: {
      frequency: 'Periodic',
      cycleTime: 'Varies',
      cycleName: 'Tournament Cycle',
    },
    requirements: [
      'At least 1 robot',
      'Robot must be battle-ready',
      'Tournament registration required',
      'Specific tournament entry requirements',
    ],
    rewards: [
      'Higher credit rewards than regular battles',
      'Significant fame bonuses',
      'Tournament-specific prizes',
      'Prestige for tournament victories',
    ],
    features: [
      'Bracket-style elimination format',
      'Higher stakes than regular battles',
      'Special event scheduling',
      'Competitive tournament structure',
    ],
    strategicConsiderations: [
      'Highest reward potential',
      'Elimination format (one loss = out)',
      'Requires peak robot condition',
      'Strategic timing for participation',
    ],
    minRobotsRequired: 1,
  },
  koth: {
    name: 'King of the Hill',
    description: 'Free-for-all zone control battles with 5-6 robots competing for dominance',
    icon: '⛰️',
    scheduling: {
      frequency: 'Mon / Wed / Fri',
      cycleTime: '16:00 UTC',
      cycleName: 'King of the Hill Cycle',
    },
    requirements: [
      'At least 1 robot',
      'Robot must be battle-ready (HP > 0, weapon equipped)',
      'One robot per stable per match',
      'No league tier restriction',
    ],
    rewards: [
      'Credits based on placement (1st–6th tiers)',
      'Fame and prestige for top finishers',
      'Kill bonus (+5 zone score per elimination)',
      'Zone dominance bonus (+25% at >75% uncontested)',
    ],
    features: [
      '5-6 robot free-for-all arena',
      'Zone control scoring (1 pt/sec uncontested)',
      'Fixed and rotating zone variants',
      'Permanent elimination on destruction',
    ],
    strategicConsiderations: [
      'Zone control vs combat aggression balance',
      'servoMotors and threatAnalysis are key attributes',
      'Anti-passive penalties for staying outside zone',
      'Kill bonuses can swing the match',
    ],
    minRobotsRequired: 1,
  },
};

/**
 * SchedulingInfo component
 * Displays when battles are scheduled.
 */
const SchedulingInfo = ({ scheduling }: { scheduling: BattleTypeInfo['scheduling'] }) => {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-secondary flex items-center gap-2">
        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        Scheduling
      </h4>
      <div className="pl-6 space-y-1">
        <div className="text-sm text-secondary">
          <span className="font-medium text-secondary">Frequency:</span> {scheduling.frequency}
        </div>
        <div className="text-sm text-secondary">
          <span className="font-medium text-secondary">Cycle Time:</span> {scheduling.cycleTime}
        </div>
        <div className="text-xs text-secondary italic">
          ({scheduling.cycleName})
        </div>
      </div>
    </div>
  );
};

/**
 * RequirementsList component
 * Displays battle requirements.
 */
const RequirementsList = ({ 
  requirements, 
  playerRobotCount,
  minRobotsRequired 
}: { 
  requirements: string[];
  playerRobotCount?: number;
  minRobotsRequired: number;
}) => {
  const meetsRobotRequirement = playerRobotCount !== undefined 
    ? playerRobotCount >= minRobotsRequired 
    : true;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-secondary flex items-center gap-2">
        <svg className="w-4 h-4 text-warning" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        Requirements
      </h4>
      <ul className="pl-6 space-y-1">
        {requirements.map((req, index) => (
          <li key={index} className="text-sm text-secondary flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{req}</span>
          </li>
        ))}
      </ul>
      
      {playerRobotCount !== undefined && !meetsRobotRequirement && (
        <div className="mt-2 p-2 bg-red-900 bg-opacity-20 border border-red-700 rounded text-xs text-error">
          ⚠️ You need {minRobotsRequired} robot{minRobotsRequired > 1 ? 's' : ''} to participate (you have {playerRobotCount})
        </div>
      )}
      
      {playerRobotCount !== undefined && meetsRobotRequirement && minRobotsRequired > 1 && (
        <div className="mt-2 p-2 bg-green-900 bg-opacity-20 border border-green-700 rounded text-xs text-success">
          ✓ You meet the robot requirement for this battle type
        </div>
      )}
    </div>
  );
};

/**
 * RewardsList component
 * Displays battle rewards.
 */
const RewardsList = ({ rewards }: { rewards: string[] }) => {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-secondary flex items-center gap-2">
        <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
        </svg>
        Rewards
      </h4>
      <ul className="pl-6 space-y-1">
        {rewards.map((reward, index) => (
          <li key={index} className="text-sm text-secondary flex items-start gap-2">
            <span className="text-success mt-0.5">•</span>
            <span>{reward}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * StrategicConsiderations component
 * Displays strategic tips for this battle type.
 */
const StrategicConsiderations = ({ considerations }: { considerations: string[] }) => {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-secondary flex items-center gap-2">
        <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
        Strategic Considerations
      </h4>
      <ul className="pl-6 space-y-1">
        {considerations.map((consideration, index) => (
          <li key={index} className="text-sm text-secondary flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            <span>{consideration}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * BattleTypeCard component
 * Main card component for displaying battle type information.
 */
const BattleTypeCard = ({
  battleType,
  compact = false,
  highlighted = false,
  playerRobotCount,
}: BattleTypeCardProps) => {
  const info = BATTLE_TYPE_INFO[battleType];
  const meetsRequirement = playerRobotCount !== undefined 
    ? playerRobotCount >= info.minRobotsRequired 
    : true;

  if (compact) {
    return (
      <div
        className={`
          bg-surface rounded-lg border-2 p-4 transition-all duration-200
          ${highlighted ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-30' : 'border-white/10'}
          ${!meetsRequirement ? 'opacity-60' : ''}
        `}
      >
        <div className="flex items-start gap-3">
          <div className="text-3xl">{info.icon}</div>
          <div className="flex-1">
            <h3 className="font-bold text-base mb-1 text-gray-100">{info.name}</h3>
            <p className="text-xs text-secondary mb-2">{info.description}</p>
            
            <div className="text-xs text-secondary">
              <span className="font-medium text-secondary">Scheduled:</span> {info.scheduling.frequency} at {info.scheduling.cycleTime}
            </div>
            
            {!meetsRequirement && (
              <div className="mt-2 text-xs text-error">
                ⚠️ Requires {info.minRobotsRequired} robot{info.minRobotsRequired > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        bg-surface rounded-lg border-2 p-6 transition-all duration-200
        ${highlighted ? 'border-blue-500 ring-4 ring-blue-500 ring-opacity-30 shadow-xl' : 'border-white/10'}
        ${!meetsRequirement ? 'opacity-75' : ''}
      `}
      role="article"
      aria-label={`${info.name} information`}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-5xl">{info.icon}</div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-1 text-gray-100">{info.name}</h3>
          <p className="text-sm text-secondary">{info.description}</p>
        </div>
      </div>

      {/* Scheduling */}
      <div className="mb-4">
        <SchedulingInfo scheduling={info.scheduling} />
      </div>

      {/* Requirements */}
      <div className="mb-4">
        <RequirementsList 
          requirements={info.requirements}
          playerRobotCount={playerRobotCount}
          minRobotsRequired={info.minRobotsRequired}
        />
      </div>

      {/* Rewards */}
      <div className="mb-4">
        <RewardsList rewards={info.rewards} />
      </div>

      {/* Features */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-secondary mb-2">Key Features</h4>
        <ul className="pl-6 space-y-1">
          {info.features.map((feature, index) => (
            <li key={index} className="text-sm text-secondary flex items-start gap-2">
              <span className="text-secondary mt-0.5">•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Strategic Considerations */}
      <div className="pt-4 border-t border-white/10">
        <StrategicConsiderations considerations={info.strategicConsiderations} />
      </div>
    </div>
  );
};

export default BattleTypeCard;
