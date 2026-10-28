/**
 * Test helpers for stored battle logs (`battles.battle_log_zst` + `battle_log_meta`).
 *
 * Production code writes and reads logs only through
 * `src/services/battle/battleLogCodec.ts` (async zstd). Fixtures often build
 * battle rows in synchronous contexts, so these helpers produce and read the
 * same stored shape with zlib's sync zstd calls.
 */
import zlib from 'node:zlib';
import { BATTLE_LOG_ZSTD_LEVEL } from '../../src/services/battle/battleLogCodec';

/** Columns to spread into a `prisma.battle.create` `data` (or a mocked battle row). */
export function battleLogFixture(log: object): {
  battleLogZst: Uint8Array<ArrayBuffer>;
  battleLogMeta: { codec: 'zstd'; level: number; rawBytes: number };
} {
  const raw = Buffer.from(JSON.stringify(log), 'utf8');
  const compressed = zlib.zstdCompressSync(raw, {
    params: { [zlib.constants.ZSTD_c_compressionLevel]: BATTLE_LOG_ZSTD_LEVEL },
  });
  return {
    battleLogZst: new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength) as Uint8Array<ArrayBuffer>,
    battleLogMeta: { codec: 'zstd', level: BATTLE_LOG_ZSTD_LEVEL, rawBytes: raw.length },
  };
}

/**
 * The log stored in a battle row or in the `data` passed to a mocked
 * `prisma.battle.create`; null when it has none. Sync, for assertions.
 */
export function readBattleLogFixture(row: { battleLogZst?: Uint8Array | null }): Record<string, any> | null {
  if (!row.battleLogZst) return null;
  return JSON.parse(zlib.zstdDecompressSync(row.battleLogZst).toString('utf8')) as Record<string, any>;
}
