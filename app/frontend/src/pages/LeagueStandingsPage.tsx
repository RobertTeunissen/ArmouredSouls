/**
 * League Standings (`/league-standings`, PRD_LEAGUE_STANDINGS v2.0).
 *
 * The viewer's league cards on top (where their robots and teams stand in each
 * of the six tiered leagues, and the league picker), then one tier: its
 * instances, and the ranked list of one instance (or of the whole tier) with
 * the promotion and demotion places and a status per row.
 *
 * URL state: `mode` (1v1, 2v2, 3v3, tag_team, koth, grand_melee), `tier`,
 * `instance` (absent = whole tier), `page` (whole tier only). Without a tier
 * the page opens on the viewer's best instance in the league.
 */
import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSeasonStore, selectSeason } from '../stores/seasonStore';
import {
  InstanceChips,
  LeagueCards,
  StandingsLegend,
  StandingsPager,
  StandingsTable,
  TierChips,
  useMyStandings,
  useStandingsPage,
} from '../components/league-standings';
import {
  bestInstanceIn,
  countBy,
  instanceLabel,
  modeFromParam,
  modeInfo,
  openingView,
  tierFromParam,
  zoneSummary,
  zoneWarning,
  type LeagueModeKey,
} from '../utils/leagueStandings';
import { getTierName } from '../utils/tierHelpers';
import type { StandingsPageRequest } from '../utils/leagueStandingsApi';

/** Instances hold at most 100, so one instance is always one page. */
const INSTANCE_PAGE_SIZE = 100;
const TIER_PAGE_SIZE = 50;
/** Same shape as the backend's `leagueInstanceId` primitive; anything else is ignored. */
const INSTANCE_ID = /^[a-z]+_[a-z0-9_]*[a-z0-9]$/;

interface ViewParams {
  mode: LeagueModeKey;
  tier: string;
  instance: string | null;
  page?: number;
}

function standingsHref({ mode, tier, instance, page }: ViewParams): string {
  const params = new URLSearchParams();
  if (mode !== '1v1') params.set('mode', mode);
  params.set('tier', tier);
  if (instance) params.set('instance', instance);
  if (!instance && page && page > 1) params.set('page', String(page));
  return `/league-standings?${params.toString()}`;
}

function LeagueStandingsPage() {
  const { user } = useAuth();
  const season = useSeasonStore(selectSeason);
  const [params, setParams] = useSearchParams();
  const my = useMyStandings();

  const mode = modeFromParam(params.get('mode'));
  const info = modeInfo(mode);
  const tierParam = tierFromParam(params.get('tier'));
  const instanceParam = params.get('instance');
  const instance = instanceParam && INSTANCE_ID.test(instanceParam) ? instanceParam : null;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  // No tier in the URL: open on the viewer's best instance once their entries are in.
  useEffect(() => {
    if (tierParam || !my.settled) return;
    const view = openingView(my.entries, mode);
    setParams(() => new URLSearchParams(standingsHref({ mode, ...view }).split('?')[1]), { replace: true });
  }, [tierParam, my.settled, my.entries, mode, setParams]);

  const request: StandingsPageRequest | null = tierParam
    ? { mode, tier: tierParam, instance, page: instance ? 1 : page, perPage: instance ? INSTANCE_PAGE_SIZE : TIER_PAGE_SIZE }
    : null;
  const standings = useStandingsPage(request);

  const tierCounts = useMemo(() => countBy(my.entries, mode, 'tier'), [my.entries, mode]);
  const instanceCounts = useMemo(() => countBy(my.entries, mode, 'leagueInstanceId'), [my.entries, mode]);

  if (!user) return null;
  const tier = tierParam ?? 'bronze';
  const viewerId = user.id;
  const stableName = user.stableName || user.username;
  const data = standings.data;
  const heading = instance ? instanceLabel(instance) : `All of ${getTierName(tier)}`;
  const warning = data ? zoneWarning(data.zoneMeta, info) : null;

  return (
    <div className="min-h-screen bg-background pb-24 text-white lg:pb-8">
      <div className="container mx-auto max-w-[1400px] space-y-5 px-4 py-8" data-testid="league-standings">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">League Standings</h1>
            <p className="mt-1 text-sm text-secondary">
              {season && !season.isLegacy ? `Season ${season.seasonNumber}` : 'This season'}
              {season?.phase === 'competitive' && ` · cycle ${season.seasonCycle} of ${season.seasonLengthCycles}`}
              {' · places move at each league\u2019s rebalance, after its battles'}
            </p>
          </div>
          <Link to="/guide/leagues/promotion-demotion" className="inline-flex min-h-[44px] items-center text-sm text-primary hover:underline">
            How leagues work ›
          </Link>
        </header>

        <LeagueCards
          entries={my.entries}
          active={mode}
          stableName={stableName}
          hrefFor={(m) => (m === '1v1' ? '/league-standings?mode=1v1' : `/league-standings?mode=${m}`)}
        />

        <TierChips
          active={tier}
          yours={tierCounts}
          hrefFor={(t) => standingsHref({ mode, tier: t, instance: bestInstanceIn(my.entries, mode, t) })}
        />

        <InstanceChips
          tier={tier}
          instances={standings.shown?.tier === tier ? standings.instances : []}
          active={instance}
          yours={instanceCounts}
          hrefFor={(i) => standingsHref({ mode, tier, instance: i })}
        />

        {!data && !standings.failed && (
          <p className="py-16 text-center text-secondary" role="status">Loading standings…</p>
        )}

        {standings.failed && (
          <div className="rounded-lg border border-error bg-error/10 p-6 text-center" role="alert">
            <p className="text-error">Failed to load the standings.</p>
            <button type="button" onClick={standings.reload} className="mt-4 min-h-[44px] rounded-lg bg-surface-elevated px-6 text-white hover:bg-surface">
              Retry
            </button>
          </div>
        )}

        {data && !standings.failed && (
          <section aria-labelledby="standings-heading" aria-busy={standings.loading} className={standings.stale ? 'opacity-60 transition-opacity' : ''}>
            <h2 id="standings-heading" className="text-2xl font-bold text-white">{heading}</h2>
            <p className="mt-1 text-sm text-secondary" data-testid="zone-summary">{zoneSummary(data.zoneMeta, info, !instance).join(' · ')}</p>
            {warning && <p className="mt-1 text-sm text-warning" data-testid="zone-warning">{warning}</p>}

            {data.rows.length === 0 ? (
              <p className="mt-6 rounded-lg border border-white/10 bg-surface p-6 text-secondary" data-testid="standings-empty">
                No {info.entity === 'robot' ? 'robots' : 'teams'} in {heading} yet.
              </p>
            ) : (
              <div className="mt-4">
                <StandingsTable
                  rows={data.rows}
                  mode={info}
                  tier={tier}
                  meta={data.zoneMeta}
                  instanceView={instance !== null}
                  viewerId={viewerId}
                  caption={`${info.label}, ${heading}`}
                />
                {!instance && (
                  <StandingsPager pagination={data.pagination} hrefFor={(p) => standingsHref({ mode, tier, instance: null, page: p })} />
                )}
              </div>
            )}
            <StandingsLegend tier={tier} />
          </section>
        )}
      </div>
    </div>
  );
}

export default LeagueStandingsPage;
