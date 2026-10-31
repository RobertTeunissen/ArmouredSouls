/**
 * Players admin page (`/admin/players`): every human stable with its activity
 * segment and issues, the stable detail panel, and the stable search.
 *
 * Segments use the dashboard's definitions (`adminThresholds.ts`): Active =
 * last activity within 3 days, Inactive = older but this season, Dormant = no
 * activity since the current season started (the stables the rollover deletes,
 * `season/dormantStables.ts`). Activity is the last login, or the registration
 * for an account that never logged in.
 *
 * @module services/admin/adminPlayersService
 */

import prisma from '../../lib/prisma';
import { AppError } from '../../errors';
import { buildUserFilter } from '../../utils/buildUserFilter';
import { getStableBattleOverlapsByUser } from '../auth/stable-battle-overlap';
import { BANKRUPTCY_RISK_THRESHOLD, INACTIVE_PLAYER_AFTER_MS } from './adminThresholds';
import { getCurrentSeason } from '../season/seasonService';
import { isDormant, seasonStartedAt } from '../season/dormantStables';
import { readStableCashflow, type StableCashflow } from './stableCashflow';

export type PlayerSegment = 'active' | 'inactive' | 'dormant';
export type PlayerIssueCode =
  | 'onboarding_stuck'
  | 'no_robots'
  | 'no_battle_ready_robots'
  | 'no_weapons'
  | 'no_battles'
  | 'low_balance';
export type StableKind = 'human' | 'automaton' | 'generated';

export interface PlayerIssue {
  code: PlayerIssueCode;
  label: string;
}

export interface PlayerRow {
  userId: number;
  username: string;
  stableName: string | null;
  robots: number;
  /** This season (robots are rebuilt every season), each battle once per stable. */
  battles: number;
  wins: number;
  /** Whole percent; null without battles. */
  winRate: number | null;
  currency: number;
  lastLoginAt: string | null;
  createdAt: string;
  segment: PlayerSegment;
  issues: PlayerIssue[];
}

export interface PlayersOverview {
  seasonNumber: number;
  seasonStartedAt: string | null;
  thresholds: { lowBalance: number; inactiveAfterDays: number };
  counts: { all: number; active: number; inactive: number; dormant: number; onboardingStuck: number; lowBalance: number };
  players: PlayerRow[];
  timestamp: string;
}

/** A robot the panel shows. */
export interface PlayerDetailRobot {
  id: number;
  name: string;
  elo: number;
  hpPercent: number;
  battleReady: boolean;
  mainWeapon: string | null;
  offhandWeapon: string | null;
  loadout: string;
  stance: string;
  wins: number;
  losses: number;
  draws: number;
  /** Robot-mode tiers (1v1 League, KotH, Grand Melee); absent = no row. */
  tiers: Partial<Record<'league_1v1' | 'koth' | 'grand_melee', string>>;
  subscriptions: string[];
}

export interface PlayerDetailTeam {
  id: number;
  name: string;
  size: number;
  /** Team-mode tiers (2v2/3v3 League, Tag Team). */
  tiers: Partial<Record<'league_2v2' | 'league_3v3' | 'tag_team', string>>;
}

export interface PlayerDetail {
  id: number;
  username: string;
  stableName: string | null;
  stableKind: StableKind;
  /** Automaton catalogue key (opens its Editor), else null. */
  automatonKey: string | null;
  role: string;
  currency: number;
  createdAt: string;
  lastLoginAt: string | null;
  segment: PlayerSegment | null;
  onboarding: { completed: boolean; skipped: boolean; currentStep: number };
  battles: number;
  wins: number;
  winRate: number | null;
  issues: PlayerIssue[];
  /** Last 10 cycles with ledger rows, oldest first, and the window totals. */
  cashflow: StableCashflow;
  robots: PlayerDetailRobot[];
  teams: PlayerDetailTeam[];
  facilities: { type: string; level: number }[];
}

export interface StableSearchResult {
  id: number;
  username: string;
  stableName: string | null;
  stableKind: StableKind;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_LIMIT = 10;

/** A battle-ready robot: health at least 80% and a main weapon (as before on this page). */
const BATTLE_READY_MIN_READINESS = 80;

/** Pure segment rule, exported for tests. */
export function playerSegment(
  stable: { lastLoginAt: Date | null; createdAt: Date },
  now: Date,
  startedAt: Date | null,
): PlayerSegment {
  if (startedAt && isDormant(stable, startedAt)) return 'dormant';
  const last = (stable.lastLoginAt ?? stable.createdAt).getTime();
  return now.getTime() - last > INACTIVE_PLAYER_AFTER_MS ? 'inactive' : 'active';
}

interface IssueFacts {
  hasCompletedOnboarding: boolean;
  onboardingSkipped: boolean;
  onboardingStep: number;
  currency: number;
  robots: { battleReadiness: number; mainWeaponId: number | null; totalBattles: number }[];
}

/** Pure issue list, exported for tests. Order: setup first, money last. */
export function playerIssues(facts: IssueFacts): PlayerIssue[] {
  const issues: PlayerIssue[] = [];
  const robots = facts.robots;
  const stuck = !facts.hasCompletedOnboarding && !facts.onboardingSkipped;
  if (stuck) issues.push({ code: 'onboarding_stuck', label: `Stuck in onboarding (step ${facts.onboardingStep})` });
  if (robots.length === 0) {
    issues.push({ code: 'no_robots', label: 'No robots' });
  } else {
    if (robots.every((r) => r.mainWeaponId === null)) issues.push({ code: 'no_weapons', label: 'No weapons equipped' });
    else if (!robots.some((r) => r.battleReadiness >= BATTLE_READY_MIN_READINESS && r.mainWeaponId !== null)) {
      issues.push({ code: 'no_battle_ready_robots', label: 'No battle-ready robots' });
    }
    if (!stuck && robots.every((r) => r.totalBattles === 0)) issues.push({ code: 'no_battles', label: 'No battles yet' });
  }
  if (facts.currency < BANKRUPTCY_RISK_THRESHOLD) issues.push({ code: 'low_balance', label: 'Low balance' });
  return issues;
}

const winRateOf = (wins: number, battles: number): number | null => (battles > 0 ? Math.round((wins / battles) * 100) : null);

function stableKindOf(user: { stableType: string; isGenerated: boolean }): StableKind {
  if (user.stableType === 'automaton') return 'automaton';
  if (user.isGenerated || user.stableType === 'generated') return 'generated';
  return 'human';
}

async function currentSeasonStart(): Promise<{ seasonNumber: number; startedAt: Date | null }> {
  const season = await getCurrentSeason();
  return { seasonNumber: season.seasonNumber, startedAt: await seasonStartedAt(season.seasonNumber) };
}

/** Every human stable with its segment and issues (87 on ACC; the page filters, sorts and pages them). */
export async function getPlayersOverview(now: Date = new Date()): Promise<PlayersOverview> {
  const [{ seasonNumber, startedAt }, users] = await Promise.all([
    currentSeasonStart(),
    prisma.user.findMany({
      where: buildUserFilter('real'),
      select: {
        id: true, username: true, stableName: true, currency: true, lastLoginAt: true, createdAt: true,
        hasCompletedOnboarding: true, onboardingSkipped: true, onboardingStep: true,
        robots: { select: { totalBattles: true, wins: true, battleReadiness: true, mainWeaponId: true } },
      },
      orderBy: { id: 'asc' },
    }),
  ]);
  const overlaps = await getStableBattleOverlapsByUser(users.map((u) => u.id));

  const players = users.map((user): PlayerRow => {
    const overlap = overlaps.get(user.id);
    const battles = user.robots.reduce((sum, r) => sum + r.totalBattles, 0) - (overlap?.battles ?? 0);
    const wins = user.robots.reduce((sum, r) => sum + r.wins, 0) - (overlap?.wins ?? 0);
    return {
      userId: user.id,
      username: user.username,
      stableName: user.stableName,
      robots: user.robots.length,
      battles,
      wins,
      winRate: winRateOf(wins, battles),
      currency: user.currency,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      segment: playerSegment(user, now, startedAt),
      issues: playerIssues({ ...user, robots: user.robots }),
    };
  });

  const count = (fn: (row: PlayerRow) => boolean): number => players.filter(fn).length;
  return {
    seasonNumber,
    seasonStartedAt: startedAt?.toISOString() ?? null,
    thresholds: { lowBalance: BANKRUPTCY_RISK_THRESHOLD, inactiveAfterDays: Math.round(INACTIVE_PLAYER_AFTER_MS / DAY_MS) },
    counts: {
      all: players.length,
      active: count((p) => p.segment === 'active'),
      inactive: count((p) => p.segment === 'inactive'),
      dormant: count((p) => p.segment === 'dormant'),
      onboardingStuck: count((p) => p.issues.some((i) => i.code === 'onboarding_stuck')),
      lowBalance: count((p) => p.issues.some((i) => i.code === 'low_balance')),
    },
    players,
    timestamp: now.toISOString(),
  };
}

/** Everything the stable detail panel shows, for any stable type. */
export async function getPlayerDetail(userId: number, now: Date = new Date()): Promise<PlayerDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, username: true, stableName: true, stableType: true, isGenerated: true, role: true, currency: true,
      createdAt: true, lastLoginAt: true, hasCompletedOnboarding: true, onboardingSkipped: true, onboardingStep: true,
      automatonProfile: { select: { catalogueKey: true } },
      robots: {
        select: {
          id: true, name: true, elo: true, currentHP: true, maxHP: true, battleReadiness: true, loadoutType: true, stance: true,
          wins: true, losses: true, draws: true, totalBattles: true, mainWeaponId: true,
          mainWeapon: { select: { weapon: { select: { name: true } } } },
          offhandWeapon: { select: { weapon: { select: { name: true } } } },
          subscriptions: { select: { eventType: true }, orderBy: { eventType: 'asc' } },
        },
        orderBy: { id: 'asc' },
      },
      facilities: { where: { level: { gt: 0 } }, select: { facilityType: true, level: true }, orderBy: { facilityType: 'asc' } },
    },
  });
  if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);

  const teams = await prisma.teamBattle.findMany({ where: { stableId: userId }, select: { id: true, teamName: true, teamSize: true }, orderBy: { id: 'asc' } });
  const [standings, overlaps, cashflow, season] = await Promise.all([
    prisma.standing.findMany({
      where: {
        OR: [
          { entityType: 'robot', entityId: { in: user.robots.map((r) => r.id) } },
          { entityType: 'team', entityId: { in: teams.map((t) => t.id) } },
        ],
      },
      select: { entityType: true, entityId: true, mode: true, tier: true },
    }),
    getStableBattleOverlapsByUser([userId]),
    readStableCashflow(userId),
    currentSeasonStart(),
  ]);
  const tierOf = (entityType: string, entityId: number, mode: string): string | undefined =>
    standings.find((s) => s.entityType === entityType && s.entityId === entityId && s.mode === mode)?.tier ?? undefined;

  const kind = stableKindOf(user);
  const overlap = overlaps.get(userId);
  const battles = user.robots.reduce((sum, r) => sum + r.totalBattles, 0) - (overlap?.battles ?? 0);
  const wins = user.robots.reduce((sum, r) => sum + r.wins, 0) - (overlap?.wins ?? 0);

  const robotTiers = (id: number): PlayerDetailRobot['tiers'] => {
    const tiers: PlayerDetailRobot['tiers'] = {};
    for (const mode of ['league_1v1', 'koth', 'grand_melee'] as const) {
      const tier = tierOf('robot', id, mode);
      if (tier) tiers[mode] = tier;
    }
    return tiers;
  };
  const teamTiers = (id: number): PlayerDetailTeam['tiers'] => {
    const tiers: PlayerDetailTeam['tiers'] = {};
    for (const mode of ['league_2v2', 'league_3v3', 'tag_team'] as const) {
      const tier = tierOf('team', id, mode);
      if (tier) tiers[mode] = tier;
    }
    return tiers;
  };

  return {
    id: user.id,
    username: user.username,
    stableName: user.stableName,
    stableKind: kind,
    automatonKey: user.automatonProfile?.catalogueKey ?? null,
    role: user.role,
    currency: user.currency,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    segment: kind === 'human' ? playerSegment(user, now, season.startedAt) : null,
    onboarding: { completed: user.hasCompletedOnboarding, skipped: user.onboardingSkipped, currentStep: user.onboardingStep },
    battles,
    wins,
    winRate: winRateOf(wins, battles),
    issues: kind === 'human' ? playerIssues({ ...user, robots: user.robots }) : [],
    cashflow,
    robots: user.robots.map((r) => ({
      id: r.id,
      name: r.name,
      elo: r.elo,
      hpPercent: r.maxHP > 0 ? Math.round((r.currentHP / r.maxHP) * 100) : 0,
      battleReady: r.battleReadiness >= BATTLE_READY_MIN_READINESS && r.mainWeaponId !== null,
      mainWeapon: r.mainWeapon?.weapon.name ?? null,
      offhandWeapon: r.offhandWeapon?.weapon.name ?? null,
      loadout: r.loadoutType,
      stance: r.stance,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      tiers: robotTiers(r.id),
      subscriptions: r.subscriptions.map((s) => s.eventType),
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.teamName, size: t.teamSize, tiers: teamTiers(t.id) })),
    facilities: user.facilities.map((f) => ({ type: f.facilityType, level: f.level })),
  };
}

/** Find any stable (player, Automaton or generated) by #id, username, email, stable or robot name. */
export async function searchStables(query: string): Promise<StableSearchResult[]> {
  const q = query.trim().replace(/^#/, '');
  const id = /^\d+$/.test(q) ? Number(q) : null;
  const contains = { contains: q, mode: 'insensitive' as const };
  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(id !== null && Number.isSafeInteger(id) ? [{ id }] : []),
        { username: contains },
        { email: contains },
        { stableName: contains },
        { robots: { some: { name: contains } } },
      ],
    },
    select: { id: true, username: true, stableName: true, stableType: true, isGenerated: true },
    // Players first, then by id: a name shared with bots lists the human stable on top.
    orderBy: [{ stableType: 'asc' }, { id: 'asc' }],
    take: SEARCH_LIMIT,
  });
  return users.slice(0, SEARCH_LIMIT).map((u) => ({ id: u.id, username: u.username, stableName: u.stableName, stableKind: stableKindOf(u) }));
}

/** Password reset is for human stables only: Automatons and generated stables never log in. */
export async function assertHumanStable(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stableType: true, isGenerated: true } });
  if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  if (stableKindOf(user) !== 'human') {
    throw new AppError('PASSWORD_RESET_NOT_ALLOWED', 'Only player accounts can have their password reset', 400);
  }
}
