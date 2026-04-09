import type { ReactNode } from 'react';

export interface RecordCardProps {
  rank: number;
  value: string;
  description: ReactNode;
  details?: ReactNode[];
  onClick?: () => void;
}

export function RecordCard({ rank, value, description, details, onClick }: RecordCardProps) {
  const getRankColor = (rank: number): string => {
    if (rank === 1) return 'text-warning';
    if (rank === 2) return 'text-secondary';
    if (rank === 3) return 'text-orange-400';
    return 'text-tertiary';
  };

  const getRankBadge = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const isTop3 = rank <= 3;
  const isFirst = rank === 1;

  const cardClasses = isFirst
    ? 'md:col-span-2 lg:col-span-3 p-6'
    : isTop3
    ? 'md:col-span-1 lg:col-span-1 p-5'
    : 'md:col-span-1 lg:col-span-1 p-4';

  const valueSize = isFirst ? 'text-4xl' : isTop3 ? 'text-2xl' : 'text-xl';
  const rankSize = isFirst ? 'text-4xl' : isTop3 ? 'text-3xl' : 'text-2xl';
  const descSize = isFirst ? 'text-lg' : isTop3 ? 'text-base' : 'text-sm';

  return (
    <div
      className={`bg-surface border ${
        isFirst ? 'border-yellow-500/70' : 'border-white/10'
      } rounded-lg hover:border-yellow-500/50 transition-all flex items-start gap-4 ${cardClasses} ${
        onClick ? 'cursor-pointer hover:bg-surface-elevated' : ''
      }`}
      onClick={onClick}
    >
      <div className={`${rankSize} font-bold ${getRankColor(rank)} ${isFirst ? 'min-w-[4rem]' : 'min-w-[3rem]'} text-center flex-shrink-0`}>
        {getRankBadge(rank)}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`${valueSize} font-bold text-warning mb-1`}>{value}</div>
        <p className={`text-secondary mb-2 ${descSize}`}>{description}</p>
        {details && details.length > 0 && (
          <div className={`space-y-1 ${isFirst ? '' : 'text-sm'}`}>
            {details.map((detail, index) => (
              <p key={index} className="text-tertiary">
                {detail}
              </p>
            ))}
          </div>
        )}
        {onClick && (
          <div className={`mt-2 text-yellow-500 hover:text-warning ${isFirst ? 'text-base' : 'text-sm'}`}>
            View Battle Details →
          </div>
        )}
      </div>
    </div>
  );
}
