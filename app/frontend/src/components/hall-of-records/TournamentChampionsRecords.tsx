/**
 * TournamentChampionsRecords — Displays tournament champions grouped by type (1v1, 2v2, 3v3).
 *
 * Requirements: R9.20
 */

import type { RecordsData, TournamentChampionRecord } from './types';

interface TournamentChampionsRecordsProps {
  records: RecordsData;
  formatDate: (dateString: string) => string;
}

export function TournamentChampionsRecords({ records, formatDate }: TournamentChampionsRecordsProps) {
  const has1v1 = records.tournamentChampions1v1 && records.tournamentChampions1v1.length > 0;
  const has2v2 = records.tournamentChampions2v2 && records.tournamentChampions2v2.length > 0;
  const has3v3 = records.tournamentChampions3v3 && records.tournamentChampions3v3.length > 0;

  if (!has1v1 && !has2v2 && !has3v3) {
    return (
      <div className="bg-surface border border-white/10 rounded-lg p-8 text-center">
        <p className="text-secondary">No tournament champions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {has1v1 && (
        <ChampionSection
          title="1v1 Tournament Champions"
          icon="🤖"
          badgeColor="bg-blue-400/20 text-blue-400"
          badgeLabel="1v1"
          champions={records.tournamentChampions1v1!}
          formatDate={formatDate}
        />
      )}
      {has2v2 && (
        <ChampionSection
          title="2v2 Tournament Champions"
          icon="⚔️"
          badgeColor="bg-emerald-400/20 text-emerald-400"
          badgeLabel="2v2"
          champions={records.tournamentChampions2v2!}
          formatDate={formatDate}
        />
      )}
      {has3v3 && (
        <ChampionSection
          title="3v3 Tournament Champions"
          icon="🗡️"
          badgeColor="bg-violet-400/20 text-violet-400"
          badgeLabel="3v3"
          champions={records.tournamentChampions3v3!}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

interface ChampionSectionProps {
  title: string;
  icon: string;
  badgeColor: string;
  badgeLabel: string;
  champions: TournamentChampionRecord[];
  formatDate: (dateString: string) => string;
}

function ChampionSection({ title, icon, badgeColor, badgeLabel, champions, formatDate }: ChampionSectionProps) {
  return (
    <div className="bg-surface border border-white/10 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>

      <div className="space-y-3">
        {champions.map((champion, idx) => (
          <div
            key={`${champion.tournamentId}-${idx}`}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-surface-elevated rounded-lg"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-amber-400 text-lg" aria-hidden="true">🏆</span>
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{champion.championName}</div>
                {champion.memberRobots && champion.memberRobots.length > 0 && (
                  <div className="text-xs text-secondary truncate">
                    {champion.memberRobots.join(', ')}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-secondary flex-shrink-0">
              <div>
                <span className="text-tertiary">Stable: </span>
                <span className="text-white">{champion.ownerStableName}</span>
              </div>
              <div>
                <span className="text-tertiary">Won: </span>
                <span className="text-white">{formatDate(champion.completedAt)}</span>
              </div>
            </div>
            <div className="text-xs text-secondary flex-shrink-0 hidden sm:block">
              {champion.tournamentName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
