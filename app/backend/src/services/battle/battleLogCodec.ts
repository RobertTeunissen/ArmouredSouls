/**
 * Battle log codec: the only way battle code writes or reads a stored combat log.
 *
 * A log is stored as one zstd frame of its JSON in `battles.battle_log_zst`, with
 * a small uncompressed descriptor in `battles.battle_log_meta` (codec, level, raw
 * size and the KotH / Grand Melee storage marker). Postgres' own TOAST
 * compression (pglz, 4 KB history) only reached ~3.3x on full KotH / Grand Melee
 * logs and ~7x on 1v1 logs; zstd reaches ~28x and ~14x on the same logs (ACC
 * measurement, 28 Oct 2026).
 *
 * `battles.battle_log` (jsonb, `legacyBattleLog` in Prisma) holds logs written
 * before this codec. Readers fall back to it until the last legacy log passes the
 * retention window; then the column is dropped and the fallback removed.
 *
 * Compression runs on libuv's thread pool (async zlib), so a 28 MB Grand Melee
 * log does not block the event loop.
 */
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import type { Prisma } from '../../../generated/prisma';
import { BattleError, BattleErrorCode } from '../../errors';
import type { BattleLogMeta, KothLogStorage } from '../../types/battleLogTypes';

const zstdCompress = promisify(zlib.zstdCompress);
const zstdDecompress = promisify(zlib.zstdDecompress);

/**
 * zstd level for new logs. Measured on ACC's 2-core host with real logs
 * (28 Oct 2026): level 6 stores ~17–20% less than level 3 (Grand Melee ×28,
 * KotH ×20, 1v1 ×14 vs raw JSON) for ~50 ms per KotH / Grand Melee log and
 * ~12 ms per 1v1 log; level 9 saves only ~5% more at twice the time.
 */
export const BATTLE_LOG_ZSTD_LEVEL = 6;

/** Columns a battle create/update writes for its log. */
export interface EncodedBattleLog {
  battleLogZst: Uint8Array<ArrayBuffer>;
  battleLogMeta: Prisma.InputJsonValue;
}

/** The stored log columns a reader must select to decode a log. */
export interface StoredBattleLogColumns {
  battleLogZst: Uint8Array | null;
  legacyBattleLog: Prisma.JsonValue | null;
}

/** Prisma `select` fragment for {@link decodeBattleLog}. */
export const BATTLE_LOG_SELECT = { battleLogZst: true, legacyBattleLog: true } as const;

/** Prisma `omit` fragment for battle reads that never need the combat log. */
export const BATTLE_LOG_OMIT = { battleLogZst: true, legacyBattleLog: true, battleLogMeta: true } as const;

/** A decoded log: the JSON object that was passed to {@link encodeBattleLog}. */
export type DecodedBattleLog = Record<string, unknown>;

function storageMarkerOf(log: object): KothLogStorage | undefined {
  const storage = (log as { storage?: unknown }).storage;
  if (typeof storage !== 'object' || storage === null) return undefined;
  const { formulas, sampled } = storage as Partial<KothLogStorage>;
  return typeof formulas === 'boolean' && typeof sampled === 'boolean' ? { formulas, sampled } : undefined;
}

/**
 * Compress a battle log for storage. Spread the result into the battle's
 * `data`: `{ ...otherFields, ...(await encodeBattleLog(log)) }`.
 */
export async function encodeBattleLog(log: object, level: number = BATTLE_LOG_ZSTD_LEVEL): Promise<EncodedBattleLog> {
  const raw = Buffer.from(JSON.stringify(log), 'utf8');
  const compressed = await zstdCompress(raw, {
    params: {
      [zlib.constants.ZSTD_c_compressionLevel]: level,
      [zlib.constants.ZSTD_c_checksumFlag]: 1,
    },
  });
  const meta: BattleLogMeta = { codec: 'zstd', level, rawBytes: raw.length };
  const storage = storageMarkerOf(log);
  if (storage) meta.storage = storage;
  return {
    battleLogZst: new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength) as Uint8Array<ArrayBuffer>,
    battleLogMeta: meta as unknown as Prisma.InputJsonValue,
  };
}

function asLogObject(value: unknown): DecodedBattleLog | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as DecodedBattleLog) : null;
}

/**
 * Decode a battle's stored log, or null when it has none (retention removed it,
 * or the battle never had one). Throws `BATTLE_LOG_UNREADABLE` for a corrupt
 * frame: a log is returned whole or not at all.
 */
export async function decodeBattleLog(row: StoredBattleLogColumns, battleId: number): Promise<DecodedBattleLog | null> {
  if (row.battleLogZst !== null) {
    try {
      const raw = await zstdDecompress(row.battleLogZst);
      return asLogObject(JSON.parse(raw.toString('utf8')));
    } catch {
      throw new BattleError(BattleErrorCode.BATTLE_LOG_UNREADABLE, 'Stored battle log could not be read', 500, { battleId });
    }
  }
  return asLogObject(row.legacyBattleLog);
}
