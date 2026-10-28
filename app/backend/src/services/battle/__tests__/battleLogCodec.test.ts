import fc from 'fast-check';
import zlib from 'node:zlib';
import {
  BATTLE_LOG_ZSTD_LEVEL,
  decodeBattleLog,
  encodeBattleLog,
} from '../battleLogCodec';

const kothLog = {
  events: [{ timestamp: 0, type: 'battle_start', message: 'Zone opens' }],
  detailedCombatEvents: [{ timestamp: 1.5, type: 'attack', formulaBreakdown: { calculation: 'Hit', components: { hitRoll: 41 }, result: 9 } }],
  storage: { formulas: true, sampled: false },
  arenaRadius: 16,
};

describe('battleLogCodec', () => {
  describe('encodeBattleLog', () => {
    it('stores one zstd frame and a descriptor with the raw size and storage marker', async () => {
      const { battleLogZst, battleLogMeta } = await encodeBattleLog(kothLog);
      // zstd frame magic number 0xFD2FB528 (little endian)
      expect(Buffer.from(battleLogZst.subarray(0, 4)).toString('hex')).toBe('28b52ffd');
      expect(battleLogMeta).toEqual({
        codec: 'zstd',
        level: BATTLE_LOG_ZSTD_LEVEL,
        rawBytes: Buffer.byteLength(JSON.stringify(kothLog)),
        storage: { formulas: true, sampled: false },
      });
    });

    it('omits the storage marker for modes that do not write one', async () => {
      const { battleLogMeta } = await encodeBattleLog({ events: [], isByeMatch: true });
      expect(battleLogMeta).not.toHaveProperty('storage');
    });

    it('compresses repetitive combat logs far below their JSON size', async () => {
      const events = Array.from({ length: 2000 }, (_, i) => ({
        timestamp: i * 0.1, type: 'movement', attacker: 'Robot A', message: `Robot A moves to (${i % 17}.0, ${i % 11}.0)`, rangeBand: 'mid',
      }));
      const log = { events: [], detailedCombatEvents: events };
      const { battleLogZst, battleLogMeta } = await encodeBattleLog(log);
      const meta = battleLogMeta as unknown as { rawBytes: number };
      expect(battleLogZst.byteLength * 10).toBeLessThan(meta.rawBytes);
    });
  });

  describe('decodeBattleLog', () => {
    it('round-trips a log through the compressed column', async () => {
      const { battleLogZst } = await encodeBattleLog(kothLog);
      await expect(decodeBattleLog({ battleLogZst, legacyBattleLog: null }, 1)).resolves.toEqual(kothLog);
    });

    it('falls back to the legacy jsonb log when there is no compressed log', async () => {
      await expect(decodeBattleLog({ battleLogZst: null, legacyBattleLog: kothLog }, 1)).resolves.toEqual(kothLog);
    });

    it('prefers the compressed log when both columns are set', async () => {
      const { battleLogZst } = await encodeBattleLog({ events: [], source: 'zst' });
      await expect(decodeBattleLog({ battleLogZst, legacyBattleLog: { source: 'legacy' } }, 1)).resolves.toEqual({ events: [], source: 'zst' });
    });

    it('returns null when the battle has no log (retention removed it)', async () => {
      await expect(decodeBattleLog({ battleLogZst: null, legacyBattleLog: null }, 1)).resolves.toBeNull();
    });

    it('returns null for a legacy value that is not a log object', async () => {
      await expect(decodeBattleLog({ battleLogZst: null, legacyBattleLog: [] }, 1)).resolves.toBeNull();
    });

    it('throws BATTLE_LOG_UNREADABLE for corrupt bytes', async () => {
      await expect(decodeBattleLog({ battleLogZst: new Uint8Array([1, 2, 3, 4]), legacyBattleLog: null }, 42))
        .rejects.toMatchObject({ code: 'BATTLE_LOG_UNREADABLE', statusCode: 500, details: { battleId: 42 } });
    });

    it('throws BATTLE_LOG_UNREADABLE for a frame that fails its checksum', async () => {
      const { battleLogZst } = await encodeBattleLog(kothLog);
      const damaged = new Uint8Array(battleLogZst);
      damaged[damaged.length - 1] ^= 0xff; // last byte belongs to the content checksum
      await expect(decodeBattleLog({ battleLogZst: damaged, legacyBattleLog: null }, 7))
        .rejects.toMatchObject({ code: 'BATTLE_LOG_UNREADABLE' });
    });

    it('throws BATTLE_LOG_UNREADABLE for a valid frame that is not JSON', async () => {
      const notJson = zlib.zstdCompressSync(Buffer.from('not json'));
      await expect(decodeBattleLog({ battleLogZst: new Uint8Array(notJson), legacyBattleLog: null }, 7))
        .rejects.toMatchObject({ code: 'BATTLE_LOG_UNREADABLE' });
    });
  });

  it('property: decode(encode(log)) equals the log for any JSON log object', async () => {
    await fc.assert(
      fc.asyncProperty(fc.dictionary(fc.string({ maxLength: 12 }), fc.jsonValue({ maxDepth: 3 })), async (log) => {
        // JSON round trip normalises -0 to 0, as the stored JSON always did.
        const expected = JSON.parse(JSON.stringify(log)) as Record<string, unknown>;
        const encoded = await encodeBattleLog(log);
        await expect(decodeBattleLog({ battleLogZst: encoded.battleLogZst, legacyBattleLog: null }, 1)).resolves.toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });
});
