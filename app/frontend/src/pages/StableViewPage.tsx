/**
 * Public stable page (`/stables/:userId`).
 *
 * Reads like a profile: who the stable is, how it is doing this season,
 * its roster with the highest tier per robot over every mode, a trophy
 * cabinet that fills itself, recent results, facilities and the season
 * history. Composition only; sections live in `components/stable-view/`.
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SeasonHistoryBlock from '../components/season/SeasonHistoryBlock';
import {
  FacilitiesStrip,
  RecentResults,
  RosterSection,
  SeasonOverview,
  StableHeader,
  TrophyCabinet,
  useStableProfile,
  type RosterEntry,
} from '../components/stable-view';
import { useAuth } from '../contexts/AuthContext';
import { useSeasonStore } from '../stores/seasonStore';
import { liveModeCells, tierSummary } from '../utils/stableViewFormat';

function StableViewPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const season = useSeasonStore((s) => s.season);
  const { state, data, reload } = useStableProfile(userId);

  const roster: RosterEntry[] = useMemo(
    () => (data?.robots ?? []).map((robot) => {
      const cells = liveModeCells(robot.standings);
      return { robot, cells, summary: tierSummary(cells) };
    }),
    [data],
  );

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background text-white">
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="text-xl text-secondary">Loading stable...</div>
        </div>
      </div>
    );
  }

  if (state === 'not-found') {
    return (
      <div className="min-h-screen bg-background text-white">
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="mb-4 text-2xl font-bold">Stable not found</h2>
          <button onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px] text-primary hover:underline">
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  if (state === 'error' || !data) {
    return (
      <div className="min-h-screen bg-background text-white">
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="mb-4 text-2xl font-bold">Failed to load stable. Please try again.</h2>
          <button
            onClick={() => void reload()}
            className="min-h-[44px] rounded bg-primary px-6 py-2 transition-colors hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { user } = data;
  const isOwner = authUser?.id === user.id;
  const accolades = data.accolades ?? [];

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="container mx-auto space-y-6 px-4 py-8 pb-24 lg:pb-8">
        <button
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] text-primary transition-colors hover:underline"
        >
          ← Back
        </button>

        <StableHeader user={user} robotCount={data.robots.length} season={season} accolades={accolades} />

        {data.robots.length > 0 && (
          <SeasonOverview strips={roster.map((r) => r.cells)} summaries={roster.map((r) => r.summary)} />
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RosterSection entries={roster} />
          </div>
          <div className="space-y-6">
            <TrophyCabinet
              achievements={data.achievements}
              accolades={accolades}
              isOwner={isOwner}
              onPinnedChange={() => void reload(true)}
            />
            <RecentResults results={data.recentResults ?? []} isOwner={isOwner} />
          </div>
        </div>

        <FacilitiesStrip facilities={data.facilities} />

        {userId && <SeasonHistoryBlock userId={Number(userId)} />}
      </div>
    </div>
  );
}

export default StableViewPage;
