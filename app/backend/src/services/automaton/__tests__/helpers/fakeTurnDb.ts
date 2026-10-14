/**
 * In-memory stand-in for the Prisma calls the turn runner makes
 * (`automaton_program_settings`, `automaton_profiles`, `automaton_turns`,
 * `users`), so `automatonTurnService.test.ts` exercises the real claim,
 * retry, lease and Program_Switch logic without a database.
 *
 * Only the query shapes the services use are supported; anything else throws.
 */

export type FakeTurnStatus = 'in_progress' | 'completed' | 'failed' | 'skipped';
export type FakeTrigger = 'settlement' | 'preparation' | 'season_open';

export interface FakeTurnRow {
  id: number;
  profileId: number;
  seasonNumber: number;
  trigger: FakeTrigger;
  slot: number;
  attempt: number;
  status: FakeTurnStatus;
  reason: string | null;
  strategyKey: string;
  strategyVersion: number;
  startBalance: number;
  endBalance: number | null;
  creditsSpent: number;
  creditsReceived: number;
  actions: unknown;
  goalOutcomes: unknown;
  upkeepIssues: unknown;
  durationMs: number | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface FakeProfileRow {
  id: number;
  userId: number | null;
  catalogueKey: string;
  strategyKey: string;
  strategyVersion: number;
  strategyParameters: unknown;
  teamNames: unknown;
  eventOrder: unknown;
  status: 'draft' | 'active';
  currency: number;
}

export interface FakeSettingsRow {
  id: number;
  turnsEnabled: boolean;
  turnStepLeaseUntil: Date | null;
  updatedAt: Date;
  updatedByUserId: number | null;
}

interface FakeDb {
  settings: FakeSettingsRow | null;
  turns: FakeTurnRow[];
  profiles: FakeProfileRow[];
  nextTurnId: number;
}

export const fakeDb: FakeDb = { settings: null, turns: [], profiles: [], nextTurnId: 1 };

export function resetFakeDb(): void {
  fakeDb.settings = { id: 1, turnsEnabled: true, turnStepLeaseUntil: null, updatedAt: new Date(0), updatedByUserId: null };
  fakeDb.turns = [];
  fakeDb.profiles = [];
  fakeDb.nextTurnId = 1;
}

type Row = Record<string, unknown>;

function pick(row: object, select: Record<string, unknown> | undefined): Row {
  const source = row as Row;
  if (!select) return { ...source };
  const out: Row = {};
  for (const key of Object.keys(select)) out[key] = source[key];
  return out;
}

interface TurnKey {
  profileId: number;
  seasonNumber: number;
  trigger: FakeTrigger;
  slot: number;
}

function findByKey(key: TurnKey): FakeTurnRow | undefined {
  return fakeDb.turns.find((t) => t.profileId === key.profileId && t.seasonNumber === key.seasonNumber
    && t.trigger === key.trigger && t.slot === key.slot);
}

function turnWhereUnique(where: { id?: number; profileId_seasonNumber_trigger_slot?: TurnKey }): FakeTurnRow | undefined {
  if (where.id !== undefined) return fakeDb.turns.find((t) => t.id === where.id);
  if (where.profileId_seasonNumber_trigger_slot) return findByKey(where.profileId_seasonNumber_trigger_slot);
  throw new Error('fakeTurnDb: unsupported unique where');
}

function requireSettings(): FakeSettingsRow {
  if (!fakeDb.settings) throw new Error('fakeTurnDb: no settings row');
  return fakeDb.settings;
}

/** Seed a finished Turn_Record (e.g. earlier Saving turns). */
export function seedTurn(row: Partial<FakeTurnRow> & TurnKey): FakeTurnRow {
  const full: FakeTurnRow = {
    id: fakeDb.nextTurnId++,
    attempt: 1,
    status: 'completed',
    reason: null,
    strategyKey: 'fixture',
    strategyVersion: 1,
    startBalance: 0,
    endBalance: 0,
    creditsSpent: 0,
    creditsReceived: 0,
    actions: [],
    goalOutcomes: [],
    upkeepIssues: [],
    durationMs: 0,
    startedAt: new Date(1_000 + fakeDb.nextTurnId),
    finishedAt: new Date(1_000 + fakeDb.nextTurnId),
    ...row,
  };
  fakeDb.turns.push(full);
  return full;
}

export const fakePrisma = {
  automatonProgramSetting: {
    async findUnique(args: { where: { id: number }; select?: Record<string, unknown> }): Promise<Row | null> {
      return fakeDb.settings && fakeDb.settings.id === args.where.id ? pick(fakeDb.settings, args.select) : null;
    },
    async findUniqueOrThrow(args: { where: { id: number }; select?: Record<string, unknown> }): Promise<Row> {
      return pick(requireSettings(), args.select);
    },
    async createMany(args: { data: { id: number }[] }): Promise<{ count: number }> {
      if (fakeDb.settings) return { count: 0 };
      fakeDb.settings = { id: args.data[0].id, turnsEnabled: true, turnStepLeaseUntil: null, updatedAt: new Date(), updatedByUserId: null };
      return { count: 1 };
    },
    async update(args: { data: { turnsEnabled: boolean; updatedByUserId: number }; select?: Record<string, unknown> }): Promise<Row> {
      const settings = requireSettings();
      settings.turnsEnabled = args.data.turnsEnabled;
      settings.updatedByUserId = args.data.updatedByUserId;
      settings.updatedAt = new Date();
      return pick(settings, args.select);
    },
  },

  /** The three lease statements of `withTurnStepLease`: claim, release, renew. */
  async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number> {
    const sql = strings.join('?');
    const settings = requireSettings();
    if (sql.includes('IS NULL OR')) {
      const [until, , current] = values as [Date, number, Date];
      const lease = settings.turnStepLeaseUntil;
      if (lease === null || lease.getTime() < current.getTime()) {
        settings.turnStepLeaseUntil = until;
        return 1;
      }
      return 0;
    }
    if (sql.includes('= NULL')) {
      const [, until] = values as [number, Date];
      if (settings.turnStepLeaseUntil?.getTime() === until.getTime()) {
        settings.turnStepLeaseUntil = null;
        return 1;
      }
      return 0;
    }
    if (sql.includes('SET "turn_step_lease_until" = ?') && sql.includes('AND "turn_step_lease_until" = ?')) {
      // Renewal: only while the lease still holds the renewer's value.
      const [next, , current] = values as [Date, number, Date];
      if (settings.turnStepLeaseUntil?.getTime() === current.getTime()) {
        settings.turnStepLeaseUntil = next;
        return 1;
      }
      return 0;
    }
    throw new Error(`fakeTurnDb: unsupported raw statement ${sql}`);
  },

  async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return fn(fakePrisma);
  },

  automatonProfile: {
    async findMany(): Promise<Row[]> {
      return fakeDb.profiles
        .filter((p) => p.status === 'active' && p.userId !== null)
        .sort((a, b) => (a.userId ?? 0) - (b.userId ?? 0))
        .map((p) => ({
          id: p.id,
          userId: p.userId,
          catalogueKey: p.catalogueKey,
          strategyKey: p.strategyKey,
          strategyVersion: p.strategyVersion,
          strategyParameters: p.strategyParameters,
          teamNames: p.teamNames,
          eventOrder: p.eventOrder,
          user: { currency: p.currency },
        }));
    },
  },

  automatonTurn: {
    async createMany(args: { data: (TurnKey & Partial<FakeTurnRow>)[]; skipDuplicates: boolean }): Promise<{ count: number }> {
      let count = 0;
      for (const data of args.data) {
        if (findByKey(data)) {
          if (!args.skipDuplicates) throw new Error('unique violation');
          continue;
        }
        seedTurn({ ...data, status: data.status ?? 'in_progress', endBalance: null, finishedAt: null, durationMs: null, startedAt: new Date() });
        count++;
      }
      return { count };
    },
    async findUniqueOrThrow(args: { where: { profileId_seasonNumber_trigger_slot: TurnKey }; select?: Record<string, unknown> }): Promise<Row> {
      const row = turnWhereUnique(args.where);
      if (!row) throw new Error('fakeTurnDb: turn not found');
      return pick(row, args.select);
    },
    async update(args: { where: { id: number }; data: Partial<FakeTurnRow>; select?: Record<string, unknown> }): Promise<Row> {
      const row = turnWhereUnique(args.where);
      if (!row) throw new Error('fakeTurnDb: turn not found');
      Object.assign(row, args.data);
      return pick(row, args.select);
    },
    async findMany(args: {
      where: { profileId: number; status: FakeTurnStatus; id: { not: number } };
      take: number;
      select?: Record<string, unknown>;
    }): Promise<Row[]> {
      return fakeDb.turns
        .filter((t) => t.profileId === args.where.profileId && t.status === args.where.status && t.id !== args.where.id.not)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || b.id - a.id)
        .slice(0, args.take)
        .map((t) => pick(t, args.select));
    },
  },

  user: {
    async findUnique(args: { where: { id: number } }): Promise<Row | null> {
      const profile = fakeDb.profiles.find((p) => p.userId === args.where.id);
      return profile ? { currency: profile.currency } : null;
    },
  },
};
