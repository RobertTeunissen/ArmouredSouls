import type { ReactNode } from 'react';
import OwnerNameLink from '../OwnerNameLink';
import { winRateClass } from './leaderboardFormat';
import type { FameLeaderboardEntry } from '@shared/types';

/** Fields every robot leaderboard (fame, destructions) shows. */
export type RobotLeaderboardEntry = Pick<
  FameLeaderboardEntry,
  'rank' | 'robotId' | 'robotName' | 'stableId' | 'stableName' | 'stableType' | 'elo' | 'wins' | 'losses' | 'draws' | 'winRate'
>;

function OwnBadge({ className = '' }: { className?: string }) {
  return <span className={`text-xs px-2 py-0.5 bg-primary/20 text-primary rounded ${className}`.trim()}>YOURS</span>;
}

interface RobotTableRowProps {
  entry: RobotLeaderboardEntry;
  isOwn: boolean;
  /** Board-specific cells between the robot name and the stable column. */
  children: ReactNode;
}

/** Desktop row: rank, robot, board-specific cells, then stable, ELO, record and win rate. */
export function RobotTableRow({ entry, isOwn, children }: RobotTableRowProps) {
  return (
    <tr className={`hover:bg-white/5 transition-colors ${isOwn ? 'bg-primary/10' : ''}`}>
      <td className="px-4 py-3 text-primary font-medium">#{entry.rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-primary font-medium">{entry.robotName}</span>
          {isOwn && <OwnBadge />}
        </div>
      </td>
      {children}
      <td className="px-4 py-3"><OwnerNameLink userId={entry.stableId} displayName={entry.stableName} stableType={entry.stableType} /></td>
      <td className="px-4 py-3 text-primary">{entry.elo}</td>
      <td className="px-4 py-3 text-secondary text-sm">{entry.wins}W-{entry.losses}L-{entry.draws}D</td>
      <td className="px-4 py-3"><span className={`font-medium ${winRateClass(entry.winRate)}`}>{entry.winRate}%</span></td>
    </tr>
  );
}

/** One label/value pair in a mobile card's stats grid. */
export function MobileStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between"><span className="text-secondary">{label}</span>{children}</div>
  );
}

interface RobotMobileCardProps {
  entry: RobotLeaderboardEntry;
  isOwn: boolean;
  /** The board's headline figure, shown top right. */
  score: ReactNode;
  /** Board-specific stats placed first in the grid. */
  stats: ReactNode;
  /** Optional content under the grid. */
  footer?: ReactNode;
}

/** Mobile card: rank, robot and score, then a stats grid ending in ELO, win rate, record and stable. */
export function RobotMobileCard({ entry, isOwn, score, stats, footer }: RobotMobileCardProps) {
  return (
    <div className={`p-4 ${isOwn ? 'bg-primary/10' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-secondary text-sm">#{entry.rank}</span>
          <span className="text-primary font-medium ml-2">{entry.robotName}</span>
          {isOwn && <OwnBadge className="ml-2" />}
        </div>
        {score}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {stats}
        <MobileStat label="ELO"><span className="text-primary">{entry.elo}</span></MobileStat>
        <MobileStat label="Win %"><span className={winRateClass(entry.winRate)}>{entry.winRate}%</span></MobileStat>
        <MobileStat label="Record"><span className="text-secondary">{entry.wins}W-{entry.losses}L-{entry.draws}D</span></MobileStat>
        <MobileStat label="Stable"><OwnerNameLink userId={entry.stableId} displayName={entry.stableName} stableType={entry.stableType} className="truncate ml-2" /></MobileStat>
      </div>
      {footer}
    </div>
  );
}
