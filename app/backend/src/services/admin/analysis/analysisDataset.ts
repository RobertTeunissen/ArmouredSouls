/**
 * The loaded battles of one analysis window, shared by the Attributes and
 * Weapons analyses. Loading is the expensive part (~70 MB at the comparison
 * cap), so only the last window is kept, for at most `CACHE_TTL_MS` and until
 * a new build is recorded.
 */
import { ANALYSIS_RANGE_DAYS, MIN_RECORDING_DAYS, type AnalysisRange } from './analysisOptions';
import { countRecordedBattles, getRecordingBounds, loadComparisons, sampleRate } from './analysisData';
import type { ComparisonSet } from './comparisons';
import type { AttributeAnalysisCollecting } from './analysisTypes';

export const DAY_MS = 24 * 3600 * 1000;
export const CACHE_TTL_MS = 10 * 60 * 1000;
/** Loaded battles are ~70 MB at the comparison cap, so only the last window is kept. */
const MAX_DATASETS = 1;

export interface Dataset {
  set: ComparisonSet;
  from: Date | null;
  battlesInRange: number;
  battlesUsed: number;
  sampled: boolean;
  createdAt: number;
}

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
}

const datasets = new Map<string, Dataset>();
const loading = new Map<string, Promise<Dataset>>();

/** Forget the loaded window (tests). */
export function clearDatasetCache(): void {
  datasets.clear();
  loading.clear();
}

/** Insert `key` as the newest entry and drop the oldest beyond `max`. */
export function remember<K, V>(map: Map<K, V>, key: K, value: V, max: number): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const oldest = map.keys().next().value as K;
    map.delete(oldest);
  }
}

export function fresh(createdAt: number, now: number): boolean {
  return now - createdAt < CACHE_TTL_MS;
}

async function load(range: AnalysisRange, since: Date, now: Date): Promise<Dataset> {
  const start = range === 'season' ? null : new Date(now.getTime() - ANALYSIS_RANGE_DAYS[range] * DAY_MS);
  const from = start && start > since ? start : null;
  const counts = await countRecordedBattles(from);
  let battlesInRange = 0;
  for (const count of counts.values()) battlesInRange += count;
  const rate = sampleRate(counts);
  const { set, battlesRead } = await loadComparisons(from, rate);
  return { set, from, battlesInRange, battlesUsed: battlesRead, sampled: rate < 1, createdAt: now.getTime() };
}

/**
 * The battles of `range` (never before `since`, the first record), keyed by
 * the newest record id so a new battle invalidates it. Concurrent callers
 * (the two pages, or several layer sets) share one load.
 */
export async function getDataset(range: AnalysisRange, since: Date, newestId: number, now: Date): Promise<Dataset> {
  const key = `${range}|${newestId}`;
  const cached = datasets.get(key);
  if (cached && fresh(cached.createdAt, now.getTime())) return cached;
  const running = loading.get(key);
  if (running) return running;
  const promise = load(range, since, now)
    .then((dataset) => {
      remember(datasets, key, dataset, MAX_DATASETS);
      return dataset;
    })
    .finally(() => loading.delete(key));
  loading.set(key, promise);
  return promise;
}

export type Readiness =
  | { ready: true; since: Date; newestId: number }
  | { ready: false; collecting: AttributeAnalysisCollecting };

/** Whether `MIN_RECORDING_DAYS` of build records exist; otherwise the "collecting" answer. */
export async function getReadiness(now: Date): Promise<Readiness> {
  const bounds = await getRecordingBounds();
  if (bounds.since && now.getTime() - bounds.since.getTime() >= MIN_RECORDING_DAYS * DAY_MS) {
    return { ready: true, since: bounds.since, newestId: bounds.newestId };
  }
  let battlesRecorded = 0;
  if (bounds.since) for (const count of (await countRecordedBattles(null)).values()) battlesRecorded += count;
  return {
    ready: false,
    collecting: {
      status: 'collecting',
      recordingSince: bounds.since ? bounds.since.toISOString() : null,
      availableFrom: bounds.since ? new Date(bounds.since.getTime() + MIN_RECORDING_DAYS * DAY_MS).toISOString() : null,
      battlesRecorded,
    },
  };
}
