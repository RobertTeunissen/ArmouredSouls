import type { ArenaSummaryProps } from './types';

export function ArenaSummary({ battleLog }: ArenaSummaryProps) {
  if (!battleLog.battleLog.arenaRadius) return null;

  const bl = battleLog.battleLog;
  const spatialEvts = bl.detailedCombatEvents ?? bl.events ?? [];

  // Collect ALL robot names from startingPositions AND all events' positions
  const robotNameSet = new Set<string>();
  if (bl.startingPositions) {
    for (const name of Object.keys(bl.startingPositions)) {
      robotNameSet.add(name);
    }
  }
  for (const event of spatialEvts) {
    if (event.positions) {
      for (const name of Object.keys(event.positions)) {
        robotNameSet.add(name);
      }
    }
  }
  const robotNames = Array.from(robotNameSet);

  // Calculate total distance moved per robot from movement events
  const totalDistance: Record<string, number> = {};
  const lastPos: Record<string, { x: number; y: number }> = {};

  if (bl.startingPositions) {
    for (const name of Object.keys(bl.startingPositions)) {
      totalDistance[name] = 0;
      lastPos[name] = bl.startingPositions[name];
    }
  }

  const firstKnownPos: Record<string, { x: number; y: number }> = {};
  const lastKnownPos: Record<string, { x: number; y: number }> = {};

  if (bl.startingPositions) {
    for (const name of Object.keys(bl.startingPositions)) {
      firstKnownPos[name] = bl.startingPositions[name];
      lastKnownPos[name] = bl.startingPositions[name];
    }
  }

  for (const event of spatialEvts) {
    if (event.positions) {
      for (const [name, pos] of Object.entries(event.positions) as [string, { x: number; y: number }][]) {
        if (!pos) continue;
        if (!firstKnownPos[name]) {
          firstKnownPos[name] = pos;
          totalDistance[name] = 0;
        }
        if (lastPos[name]) {
          const dx = pos.x - lastPos[name].x;
          const dy = pos.y - lastPos[name].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.01) {
            totalDistance[name] = (totalDistance[name] || 0) + dist;
          }
        }
        lastPos[name] = pos;
        lastKnownPos[name] = pos;
      }
    }
  }

  if (bl.endingPositions) {
    for (const name of Object.keys(bl.endingPositions)) {
      lastKnownPos[name] = bl.endingPositions[name];
    }
  }

  // Range band distribution
  const rangeBandCounts: Record<string, number> = { melee: 0, short: 0, mid: 0, long: 0 };
  let totalRangeBandEvents = 0;
  for (const event of spatialEvts) {
    if (event.rangeBand && rangeBandCounts[event.rangeBand] !== undefined) {
      rangeBandCounts[event.rangeBand]++;
      totalRangeBandEvents++;
    }
  }

  const rangeBandColors: Record<string, string> = {
    melee: 'text-error',
    short: 'text-warning',
    mid: 'text-success',
    long: 'text-primary',
  };

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">🗺️ Arena Summary</h3>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between bg-background rounded px-2 py-1">
            <span className="text-secondary">Arena Radius</span>
            <span>{bl.arenaRadius} units</span>
          </div>
          <div className="flex justify-between bg-background rounded px-2 py-1">
            <span className="text-secondary">Arena Diameter</span>
            <span>{bl.arenaRadius! * 2} units</span>
          </div>
        </div>
        <div className="space-y-1">
          {robotNames.map((name) => (
            <div key={name} className="flex justify-between bg-background rounded px-2 py-1">
              <span className="text-secondary">{name} moved</span>
              <span>{(totalDistance[name] || 0).toFixed(1)} units</span>
            </div>
          ))}
        </div>
      </div>

      {robotNames.length > 0 && (
        <div className="grid grid-cols-2 gap-4 text-xs mt-2">
          <div className="space-y-1">
            <div className="text-xs text-secondary font-bold mb-1">Starting Positions</div>
            {robotNames.map((name) => {
              const pos = firstKnownPos[name];
              return pos ? (
                <div key={name} className="flex justify-between bg-background rounded px-2 py-1">
                  <span className="text-secondary">{name}</span>
                  <span className="font-mono text-xs">({pos.x.toFixed(1)}, {pos.y.toFixed(1)})</span>
                </div>
              ) : null;
            })}
          </div>
          <div className="space-y-1">
            <div className="text-xs text-secondary font-bold mb-1">Ending Positions</div>
            {robotNames.map((name) => {
              const pos = lastKnownPos[name];
              return pos ? (
                <div key={name} className="flex justify-between bg-background rounded px-2 py-1">
                  <span className="text-secondary">{name}</span>
                  <span className="font-mono text-xs">({pos.x.toFixed(1)}, {pos.y.toFixed(1)})</span>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}

      {totalRangeBandEvents > 0 && (
        <div className="mt-2">
          <div className="text-xs text-secondary font-bold mb-1">Range Band Distribution</div>
          <div className="flex gap-2">
            {(['melee', 'short', 'mid', 'long'] as const).map((band) => {
              const count = rangeBandCounts[band];
              const pct = totalRangeBandEvents > 0 ? (count / totalRangeBandEvents) * 100 : 0;
              return (
                <div key={band} className="flex-1 bg-background rounded px-2 py-1 text-center text-xs">
                  <div className={`font-bold capitalize ${rangeBandColors[band]}`}>{band}</div>
                  <div>{pct.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
